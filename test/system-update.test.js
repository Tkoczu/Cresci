import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SystemUpdateManager,
  systemUpdateConstants,
} from '../src/system-update.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const executableFs = {
  statSync: () => ({
    isFile: () => true,
  }),
  accessSync: () => {},
  readFileSync: () => {
    throw new Error('missing');
  },
};

test(
  'system updater is unavailable outside the explicit production LXC contract',
  async () => {
    let called = false;

    const manager = new SystemUpdateManager({
      appRoot: root,
      platform: 'win32',
      uid: null,
      env: {
        NODE_ENV: 'development',
      },
      fsImpl: executableFs,
      runCommand: async () => {
        called = true;
      },
    });

    assert.equal(manager.status().available, false);

    await assert.rejects(
      () =>
        manager.start({
          targetVersion: '1.0.2',
        }),
      /tylko w produkcyjnej instalacji/,
    );

    assert.equal(called, false);
  },
);

test(
  'production updater starts only the fixed helper and blocks duplicate requests',
  async () => {
    let calls = 0;

    const manager = new SystemUpdateManager({
      platform: 'linux',
      uid: 1001,
      env: {
        NODE_ENV: 'production',
        CRESCI_UPDATE_ENABLED: '1',
      },
      fsImpl: executableFs,
      runCommand: async () => {
        calls += 1;
      },
      now: () => 100000,
    });

    const started = await manager.start({
      targetVersion: '1.0.2',
    });

    assert.equal(started.state, 'queued');
    assert.equal(calls, 1);

    await assert.rejects(
      () =>
        manager.start({
          targetVersion: '1.0.2',
        }),
      /już uruchomiona/,
    );

    assert.equal(calls, 1);

    assert.deepEqual(systemUpdateConstants, {
      APP_ROOT: '/opt/cresci',
      UPDATER: '/opt/cresci/scripts/update.sh',
      STATUS_FILE: '/var/lib/cresci-updater/status.json',
      SUDO: '/usr/bin/sudo',
      SYSTEMCTL: '/usr/bin/systemctl',
      UPDATE_UNIT: 'cresci-update.service',
    });
  },
);

test('status survives application restart and exposes rollback outcome', () => {
  const payload = {
    state: 'failed',
    stage: 'rollback',
    message: 'Aktualizacja nie powiodła się.',
    rollback_succeeded: true,
    updated_at: '2026-08-29T12:00:00.000Z',
  };

  const manager = new SystemUpdateManager({
    platform: 'linux',
    uid: 1001,
    env: {
      NODE_ENV: 'production',
      CRESCI_UPDATE_ENABLED: '1',
    },
    fsImpl: {
      ...executableFs,
      readFileSync: () => JSON.stringify(payload),
    },
    now: () => Date.parse(payload.updated_at) + 1000,
  });

  assert.deepEqual(manager.status(), {
    available: true,
    reason: null,
    ...payload,
  });
});

test(
  'server exposes fixed update endpoints without accepting commands or paths',
  () => {
    const server = fs.readFileSync(
      path.join(root, 'server.js'),
      'utf8',
    );

    const manager = fs.readFileSync(
      path.join(root, 'src', 'system-update.js'),
      'utf8',
    );

    assert.match(
      server,
      /POST[^\n]+\/api\/system\/update/,
    );

    assert.match(
      server,
      /GET[^\n]+\/api\/system\/update-status/,
    );

    assert.doesNotMatch(
      server,
      /input\.command|input\.path|bodyJson\(req\).*system\/update/,
    );

    assert.match(
      manager,
      /execFile\(SUDO,\s*\[SYSTEMCTL,\s*'start',\s*'--no-block',\s*UPDATE_UNIT\]/,
    );

    assert.doesNotMatch(
      manager,
      /\bshell\s*:/,
    );
  },
);

test(
  'LXC integration keeps the web app unprivileged and updates only from a GitHub Release tag',
  () => {
    const updater = fs.readFileSync(
      path.join(root, 'scripts', 'update.sh'),
      'utf8',
    );

    const helper = fs.readFileSync(
      path.join(root, 'scripts', 'install-update-helper.sh'),
      'utf8',
    );

    const runner = fs.readFileSync(
      path.join(root, 'scripts', 'update-runner.sh'),
      'utf8',
    );

    const installer = fs.readFileSync(
      path.join(root, 'scripts', 'install-proxmox.sh'),
      'utf8',
    );

    // update.sh ma być tylko bezpiecznym wejściem do stałego helpera.
    assert.match(
      updater,
      /RUNNER="\/usr\/local\/libexec\/cresci-update-runner"/,
    );

    assert.match(
      updater,
      /exec sudo "\$\{RUNNER\}"/,
    );

    // To runner sprawdza najnowszy oficjalny GitHub Release.
    assert.match(
      runner,
      /api\.github\.com\/repos\/\$\{GITHUB_REPO\}\/releases\/latest/,
    );

    assert.match(
      runner,
      /\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/,
    );

    // Instalowana jest wersja wskazana przez tag Release.
    assert.match(
      runner,
      /checkout --force "\$\{LATEST_VERSION\}"/,
    );

    // Aktualizator nie może przełączać aplikacji na main.
    assert.doesNotMatch(
      runner,
      /checkout[^\n]+main|pull[^\n]+main/,
    );

    // Blokada przed równoczesnym uruchomieniem dwóch aktualizacji.
    assert.match(
      runner,
      /LOCK_FILE="\/run\/cresci-update\.lock"/,
    );

    // Po aktualizacji prawa do kodu muszą być przywrócone tak,
    // aby aplikacja mogła działać jako użytkownik cresci.
    assert.match(
      runner,
      /chown -R root:root "\$\{APP_DIR\}"/,
    );

    assert.match(
      runner,
      /find "\$\{APP_DIR\}" -type d -exec chmod 755/,
    );

    assert.match(
      runner,
      /find "\$\{APP_DIR\}" -type f -exec chmod 644/,
    );

    assert.match(
      runner,
      /chown -R "\$\{WEB_USER\}:\$\{WEB_GROUP\}"/,
    );

    // Tylko stała komenda systemctl może być wykonana przez web usera.
    assert.match(
      helper,
      /cresci ALL=\(root\) NOPASSWD: \/usr\/bin\/systemctl start --no-block cresci-update\.service/,
    );

    assert.match(
      helper,
      /User=cresci/,
    );

    // Nowa instalacja również musi działać bez roota.
    assert.match(
      installer,
      /User=cresci/,
    );

    assert.match(
      installer,
      /CRESCI_UPDATE_ENABLED=1/,
    );

    assert.doesNotMatch(
      installer,
      /User=root\s*\n\s*\n\[Install\]/,
    );

    // Installer również wybiera najnowszy oficjalny Release.
    assert.match(
      installer,
      /api\.github\.com\/repos\/\$\{GITHUB_REPO\}\/releases\/latest/,
    );

    assert.doesNotMatch(
      installer,
      /git checkout[^\n]+main|git pull[^\n]+main/,
    );
  },
);
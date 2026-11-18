# Публикация «Тарифов моделей»

Плагин для DSH — это обычный **npm-пакет** с манифестом `dsh`. Отдельного «сервера плагинов» не нужно: npm хранит пакет, а DSH сам ставит его в профиль и раздаёт браузерную половину.

## Статус

- `dsh-peak-opencode@0.4.5` опубликован **19.11.2026**, тег `latest`. Название в интерфейсе — «OpenCode Go cost/peak».
- Страница: https://www.npmjs.com/package/dsh-peak-opencode
- Tarball: https://registry.npmjs.org/dsh-peak-opencode/-/dsh-peak-opencode-0.4.5.tgz
- Исходники: https://github.com/lavandiI/dsh-peak-opencode
- `0.0.0-stage` в списке версий — служебный placeholder, который npm создаёт при первой публикации нового имени. Это нормально.
- Следующая публикация: поднять `version` в `package.json`, обновить `CHANGELOG.md`, затем запустить workflow **Publish** (`.github/workflows/publish.yml`) с `dry_run: false` или выполнить `npm publish --access public` вручную (токен должен иметь bypass 2FA).

## Как это устроено

1. Пользователь ставит пакет в профиль:

   ```text
   dsh plugin --profile desktop add dsh-peak-opencode
   ```

   или через GUI: **Настройки → Плагины → Установить** → `dsh-peak-opencode`.

2. DSH добавляет пакет в `dependencies` профиля и в `dsh.profile.bundles`.
3. Хостовая половина читает `dsh.bundle.patch` → `cordis.patch.yml` и добавляет запись `peak-opencode`.
4. Клиентская половина находится по `dsh.client`; DSH вклеивает её в boot-граф страницы как часть сборного скрипта `/plugins/...`. Отдельного URL у плагина нет: в 0.2.2-rc.3 путь `/plugins/<пакет>/client.js` отвечает 404, потому что модуль-система раздаёт только сборные комбо-скрипты и ассеты пакета.
5. После установки — перезапуск DSH и обновление страницы.

Пакет из npm ставится так же, как локальный: разница только в `source` (`dsh-peak-opencode@0.4.5` вместо `link:...`).

## Что уже готово

- Имя `dsh-peak-opencode` занято этим пакетом; версия `0.4.5` опубликована.
- `package.json` содержит `name`, `version`, `description`, `license: MIT`, `author`, `repository`, `homepage`, `bugs`, `icon`, `dsh.bundle.patch`, `dsh.client`, `exports`, `files` и `npm test`.
- `npm pack --dry-run`: 26 файлов, ~70 КБ — `lib/`, `assets/icon.svg`, `locale/`, `detail/`, `cordis.patch.yml`, `README.md`, `README-ru.md`, `PUBLISHING.md`, `CHANGELOG.md`, `LICENSE`, `package.json`. `test/`, `artifacts/` и `AUDIT.md` в пакет не попадают.
- Плагин не содержит секретов, не делает `postinstall` и не требует API-ключа: каталог OpenCode Go публичный.

## Чего не хватает для релиза

Метаданные (`repository`, `homepage`, `bugs`) заполнены начиная с 0.4.4, поэтому остаётся только релизный чек-лист:

- версия в `package.json` совпадает с тегом `vX.Y.Z` и верхней записью в `CHANGELOG.md`;
- в README и README-ru в разделе установки нет локальных путей;
- `npm test` и `npm pack --dry-run` проходят (то же самое делает CI).

## Публикация

```powershell
cd <path-to-plugin>
npm test
npm pack --dry-run
npm login          # или npm token / доверенная публикация в CI
npm publish --access public
```

Проверка после публикации:

```powershell
npm view dsh-peak-opencode version
npm view dsh-peak-opencode dist.tarball
```

### GitHub

Репозиторий: <https://github.com/lavandiI/dsh-peak-opencode>.

- CI (`.github/workflows/ci.yml`) гоняет `npm ci`, `npm test` и `npm pack --dry-run` на Node 22 и 24 для каждого push и pull request.
- Ручной workflow `Publish` (`.github/workflows/publish.yml`) публикует пакет по кнопке: по умолчанию `--dry-run`, для реальной публикации нужен секрет `NPM_TOKEN` и снятый флаг dry-run.
- Действия в обоих workflow прибиты к SHA (Dependabot продолжает их обновлять). У публикации есть окружение `npm` (точка для required reviewers), защита от повторной публикации уже занятой версии и запрет параллельных запусков.
- Релиз: поднять версию в `package.json`, обновить `CHANGELOG.md`, закоммитить, поставить тег `vX.Y.Z`, запушить, опубликовать в npm и создать GitHub Release с заметками из CHANGELOG.

### Обновления

- Поднимайте версию по semver: исправление — `0.4.6`, новая возможность — `0.5.0`, несовместимое изменение — `1.0.0`.
- Публикуйте workflow **Publish** или `npm publish`; тег `latest` обновляется автоматически.
- Пользователи обновляются через `dsh plugin --profile desktop add dsh-peak-opencode@0.4.5` или плагин-менеджер.
- Не меняйте смысл уже опубликованной версии; для отката используйте `npm dist-tag` / новую версию.

### Доверенная публикация в CI (опционально)

Сейчас `publish.yml` запускается вручную (`workflow_dispatch`): по умолчанию `dry_run: true`, для реальной публикации нужен секрет `NPM_TOKEN` и снятый флаг. Публикация идёт с `--provenance` и `permissions: id-token: write`, поэтому у версии появляется подпись и ссылка на исходники.

Можно перейти на npm Trusted Publishing (OIDC) и убрать долгоживущий токен:

1. В настройках пакета на npm добавьте trusted publisher (GitHub Actions, репозиторий + workflow `publish.yml`).
2. Уберите `NODE_AUTH_TOKEN` из шага публикации — npm получит короткоживущий токен по OIDC.
3. Пользователи по-прежнему получают provenance-подпись и ссылку на исходники.

## Витрина и каталоги

- **npm** — основной способ: имя пакета и есть адрес установки.
- **Официальный каталог DSH** (флаг `official` в списке bundle) — курируется DeepSeek; это не общий приём заявок, а набор проверенных бандлов.
- **Экспериментальный Plugin Market** (`@deepseek-ai/dsh-experimental-plugin-market-bundle`) умеет читать пользовательские plugin indexes. Это способ сделать витрину/подборку, но не обязательный: пакет в npm уже доступен по имени.
- Сообщество: добавьте ссылку в README/awesome-список, если он появится.

## Безопасность и гигиена

- Не публикуйте `node_modules/`, `artifacts/` со скриншотами личной переписки и временные файлы (`files` уже ограничивает пакет).
- Не добавляйте секреты и токены; плагин должен работать без ключей.
- Проверяйте `npm pack --dry-run` перед каждым релизом.
- Держите `LICENSE` и `CHANGELOG.md`; лицензия MIT уже есть.
- Для баг-репортов и вопросов в `package.json` должны быть `repository`/`bugs` — сейчас они указывают на GitHub-репозиторий.

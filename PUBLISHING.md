# Публикация «Тарифов моделей»

Плагин для DSH — это обычный **npm-пакет** с манифестом `dsh`. Отдельного «сервера плагинов» не нужно: npm хранит пакет, а DSH сам ставит его в профиль и раздаёт браузерную половину.

## Статус

- `dsh-peak-opencode@0.4.4` опубликован **11.11.2026**, тег `latest`. Название в интерфейсе — «OpenCode Go cost/peak».
- Страница: https://www.npmjs.com/package/dsh-peak-opencode
- Tarball: https://registry.npmjs.org/dsh-peak-opencode/-/dsh-peak-opencode-0.4.4.tgz
- Исходники: https://github.com/lavandiI/dsh-peak-opencode
- `0.0.0-stage` в списке версий — служебный placeholder, который npm создаёт при первой публикации нового имени. Это нормально.
- Следующая публикация: поднять `version` в `package.json`, обновить `CHANGELOG.md` и выполнить `npm publish --access public` (токен должен иметь bypass 2FA).

## Как это устроено

1. Пользователь ставит пакет в профиль:

   ```text
   dsh plugin --profile desktop add dsh-peak-opencode
   ```

   или через GUI: **Настройки → Плагины → Установить** → `dsh-peak-opencode`.

2. DSH добавляет пакет в `dependencies` профиля и в `dsh.profile.bundles`.
3. Хостовая половина читает `dsh.bundle.patch` → `cordis.patch.yml` и добавляет запись `peak-opencode`.
4. Клиентская половина находится по `dsh.client`; DSH отдаёт её как `/plugins/dsh-peak-opencode/client.js` и вставляет в boot-граф страницы.
5. После установки — перезапуск DSH и обновление страницы.

Пакет из npm ставится так же, как локальный: разница только в `source` (`dsh-peak-opencode@0.2.1` вместо `link:...`).

## Что уже готово

- Имя `dsh-peak-opencode` занято этим пакетом; версия `0.4.0` опубликована.
- `package.json` содержит `name`, `version`, `description`, `license: MIT`, `author`, `icon`, `dsh.bundle.patch`, `dsh.client`, `exports`, `files` и `npm test`.
- `npm pack --dry-run`: 27 файлов, ~157 КБ — `lib/`, `assets/icon.svg`, `assets/preview.png`, `locale/`, `detail/`, `cordis.patch.yml`, `README.md`, `README-ru.md`, `PUBLISHING.md`, `CHANGELOG.md`, `LICENSE`, `package.json`. `test/` и `artifacts/` в пакет не попадают.
- Плагин не содержит секретов, не делает `postinstall` и не требует API-ключа: каталог OpenCode Go публичный.

## Что добавить дальше

Для будущих версий желательно заполнить метаданные (сейчас есть `author`, но нет ссылок на репозиторий):

```json
{
  "repository": { "type": "git", "url": "git+https://github.com/<user>/dsh-peak-opencode.git" },
  "homepage": "https://github.com/<user>/dsh-peak-opencode#readme",
  "bugs": { "url": "https://github.com/<user>/dsh-peak-opencode/issues" }
}
```

Проверьте, что версия в `package.json` соответствует тегу и `CHANGELOG.md`, а README не содержит локальных путей в разделе установки (там уже есть установка из npm).

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
- Релиз: поднять версию в `package.json`, обновить `CHANGELOG.md`, закоммитить, поставить тег `vX.Y.Z`, запушить, опубликовать в npm и создать GitHub Release с заметками из CHANGELOG.

### Обновления

- Поднимайте версию по semver: `0.2.2`, `0.2.3`, `0.3.0`.
- Публикуйте `npm publish`; тег `latest` обновляется автоматически.
- Пользователи обновляются через `dsh plugin --profile desktop add dsh-peak-opencode@0.2.2` или плагин-менеджер.
- Не меняйте смысл уже опубликованной версии; для отката используйте `npm dist-tag` / новую версию.

### Доверенная публикация в CI (опционально)

Первую версию удобнее опубликовать вручную: npm Trusted Publishing (OIDC) можно привязать только к уже существующему пакету. После первой публикации:

1. В настройках пакета на npm добавьте trusted publisher (GitHub Actions, репозиторий + workflow).
2. В GitHub Actions публикуйте по тегу `v*` с `permissions: id-token: write` и `npm publish --provenance --access public`.
3. Пользователи получают provenance-подпись и ссылку на исходники.

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
- Для баг-репортов и вопросов нужны `repository`/`bugs` — добавьте их до публикации.

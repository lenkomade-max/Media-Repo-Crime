# 🚨 СРОЧНОЕ ИСПРАВЛЕНИЕ WORKFLOW 3TuNc9SUt9EDDqii

## 🔍 Проблема
На скриншоте видно ошибку: **"Credentials could not be decrypted"** в ноде "AI Сценарист".

## 🎯 Причина
Credentials для OpenRouter API повреждены или используют неправильный ключ шифрования.

## 🔧 СРОЧНОЕ ИСПРАВЛЕНИЕ

### Вариант 1: Через N8N UI (РЕКОМЕНДУЕТСЯ)

1. **Откройте workflow:** https://mayersn8n.duckdns.org/workflow/3TuNc9SUt9EDDqii

2. **Кликните на ноду "AI Сценарист"** (с красным треугольником)

3. **В настройках ноды найдите поле "Credential"**

4. **Выберите "OpenRouter account"** из списка или создайте новый:
   - Нажмите "+" рядом с полем Credential
   - Выберите "OpenRouter API"
   - Введите ваш API ключ OpenRouter
   - Сохраните как "OpenRouter account"

5. **Сохраните нод** (Ctrl+S)

### Вариант 2: Через SSH (если есть доступ)

```bash
# 1. Подключитесь к серверу
ssh root@178.156.142.35

# 2. Проверьте credentials
docker exec root-db-1 psql -U n8n -d n8n -c "SELECT id, name, type FROM credentials_entity WHERE type = 'openRouterApi';"

# 3. Если credentials есть, обновите workflow
docker exec root-db-1 psql -U n8n -d n8n -c "
UPDATE workflow_entity 
SET nodes = jsonb_set(
    nodes::jsonb, 
    '{0,credentials,openRouterApi}', 
    '{\"id\":\"dctACn3yXSG7qIdH\",\"name\":\"OpenRouter account\"}'
) 
WHERE id = '3TuNc9SUt9EDDqii';
"

# 4. Перезапустите N8N
docker restart root-n8n-1
```

### Вариант 3: Пересоздание Credentials

1. **Зайдите в Credentials:** https://mayersn8n.duckdns.org/credentials

2. **Найдите "OpenRouter account"** и удалите его

3. **Создайте новый:**
   - Нажмите "Add Credential"
   - Выберите "OpenRouter API"
   - Введите ваш API ключ
   - Назовите "OpenRouter account"
   - Сохраните

4. **Вернитесь в workflow** и переназначьте credential

## 🎯 Дополнительные исправления

После исправления credentials, проверьте другие ноды:

### Memory Node (Simple Memory)
- Добавьте параметр: `sessionIdExpression = {{ $workflow.executionId }}`

### HTTP Request (MCP сервер)
- URL: `http://178.156.142.35:4123/api/create-video`
- Method: `POST`
- Headers: `Content-Type: application/json`

### Google Drive Node
- Проверьте что выбран правильный Google Drive credential

## 🚀 После исправления

1. **Сохраните workflow** (Ctrl+S)
2. **Активируйте workflow** (переключатель в правом верхнем углу)
3. **Нажмите "Execute workflow"**
4. **Введите тестовые данные:**
   ```json
   {
     "topic": "Детективная история о серийном убийце"
   }
   ```

## ✅ Ожидаемый результат

После исправления workflow должен:
- ✅ Успешно обработать AI запрос
- ✅ Создать видео через MCP сервер
- ✅ Загрузить на Google Drive
- ✅ Вернуть ссылку на готовое видео

---

**🚨 ВАЖНО:** Проблема в том, что мои предыдущие исправления не были применены к реальному workflow. Нужно исправить через UI или SSH команды выше.



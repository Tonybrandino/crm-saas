# Firebase Stack v1

Este workspace foi preparado para subir o CRM com:

- Firebase Hosting
- Firebase Auth (email/senha)
- Cloud Firestore
- Firestore Security Rules multi-tenant
- Painel admin no mesmo frontend

## Arquivos criados

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `firebase-config.example.js`
- `firebase-app-bridge.js`

## Estrutura sugerida no Firestore

```text
tenants/{tenantId}
tenants/{tenantId}/users/{uid}
tenants/{tenantId}/leads/{leadId}
tenants/{tenantId}/tasks/{taskId}
tenants/{tenantId}/interactions/{interactionId}
tenants/{tenantId}/comments/{commentId}
tenants/{tenantId}/tags/{tagId}
tenants/{tenantId}/customFields/{fieldId}
tenants/{tenantId}/automationRules/{ruleId}
tenants/{tenantId}/auditLogs/{logId}
tenants/{tenantId}/app/bootstrap
```

No estado atual, o frontend foi preparado para:

1. continuar funcionando localmente
2. usar Firebase Auth quando configurado
3. sincronizar um snapshot completo do estado em `tenants/{tenantId}/app/bootstrap`

## Passos para ativar

1. Criar projeto no Firebase.
2. Ativar Authentication > Email/Password.
3. Criar banco Firestore em modo Production.
4. Copiar `firebase-config.example.js` para `firebase-config.js`.
5. Preencher as chaves reais do projeto.
6. Criar manualmente pelo menos um documento:

```text
tenants/tenant-demo/users/SEU_UID
```

Exemplo:

```json
{
  "nome": "Administrador",
  "email": "admin@seudominio.com",
  "role": "admin",
  "active": true
}
```

## Deploy

Quando o Firebase CLI estiver instalado e autenticado:

```bash
firebase login
firebase init hosting firestore
firebase deploy
```

## Próxima evolução recomendada

- substituir o snapshot único por coleções reais sincronizadas
- trocar o reset local por fluxo completo de e-mail do Firebase
- mover criação de usuários administrativos para Cloud Functions ou backend seguro
- usar custom claims para papel/tenant em vez de depender só do documento do usuário

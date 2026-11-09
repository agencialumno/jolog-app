# Modelo de dados (Firestore)

Derivado de `supabase/migrations/0001_init.sql` (removido). Datas sao `Timestamp`; valores em centavos.
Escrita sensivel so pelo servidor (Admin SDK). Regras em `firestore.rules`, testadas em `test/firestore-rules.test.ts`.

| Colecao | Id | Campos principais | Cliente le | App escreve |
| --- | --- | --- | --- | --- |
| `profiles` | uid do Firebase Auth | `role` (espelho do claim), `name`, `phone`, `cpfCnpj`, `createdAt` | proprio; admin | so `name`, `phone`, `cpfCnpj` do proprio |
| `properties` | auto | `ownerId`, `address`, `condominium`, `bedrooms` (2 ou 3) | dono; admin | dono (cria/edita/apaga) |
| `bookings` | auto | `customerId`, `propertyId`, `serviceType`, `status`, `startsAt`, `endsAt`, `durationMinutes`, `priceCents`, `assignedStaff`, `holdExpiresAt`, `canceledAt`, `refundPercent`, `needsRefund`, `notes`, `createdAt`, `team`, `slotKeys[]`, `laundry{}`, `inspection{}` | dono; equipe atribuida; admin | nunca |
| `bookings/{id}/photos` | auto | `kind` (before/after), `storagePath` (caminho no Blob, nao e URL), `contentType`, `size`, `uploadedBy`, `createdAt` | dono; equipe atribuida; admin | nunca (upload via API) |
| `payments` | auto | `bookingId`, `method` (pix/link), `status`, `providerId`, `pixCopiaECola`, `paymentLink`, `paidAt` | dono do booking; admin | nunca |
| `invoices` | id do booking | `externalId`, `status`, `pdfUrl` (do provedor), `number`, `error`, `updatedAt` | dono; admin | nunca |
| `reviews` | id do booking | `customerId`, `rating` (1-5), `comment`, `createdAt` | dono; admin | dono, so se o booking esta `completed` |
| `inspectionChecklistItems` | auto | `label`, `active`, `position` | logado | nunca (admin via API) |
| `paymentEvents` | `event_id` do provedor | `receivedAt` | ninguem | nunca |
| `slotLocks` | `t{equipe}_{YYYY-MM-DDTHH}` (UTC) | `bookingId`, `team`, `expiresAt`, `hour` | ninguem | nunca |

## Dados embutidos no booking

- `laundry` (so `serviceType=laundry`): `cycles`, `desiredDate` (YYYY-MM-DD), `contactPhone`, `contactStatus` (`pending|contacted|confirmed|unavailable`), `confirmedDate`.
- `inspection` (so `serviceType=inspection`): `items[]` com `itemId` (catalogo) ou `customLabel`, `result` (`ok|problem`), `resultNote`.
- Lavanderia nao usa agenda: `startsAt/endsAt/team` nulos e `slotKeys` vazio.

## Papeis

Custom claim `role` (`cliente|equipe|admin`) no token do Firebase, definido **somente no servidor**
(`POST /api/me/init` define sempre `cliente`; `POST /api/admin/users/:uid/role` so admin; primeiro admin por `scripts/create-admin.ts`).

## Conflito de horario

Cada booking de limpeza/vistoria reserva um doc `slotLocks` por hora cheia ocupada e por equipe, dentro de uma transacao.
Dois pedidos para o mesmo horario nao conseguem criar o mesmo doc: a transacao do segundo reler o doc, ve ocupado e tenta a proxima equipe
(`SCHEDULE_TEAMS`, padrao 1) ou falha com 409.

- Reserva `pending_payment` vale 15 min (`holdExpiresAt` e `slotLocks.expiresAt`). Nao ha cron: `expiresAt` vencido conta como livre ao reservar
  e `effectiveStatus()` le o booking vencido como `canceled`.
- Pago: `slotLocks.expiresAt = null` (permanente). Cancelado/expirado/reembolsado: slots do booking sao apagados.
- Pagamento que chega depois do vencimento: se o horario continua livre, confirma; se foi ocupado, `needsRefund=true` e o booking fica `canceled`.

## Indices

`firestore.indexes.json`: `bookings(customerId, createdAt desc)`, `bookings(assignedStaff, createdAt desc)`, `inspectionChecklistItems(active, position)`.

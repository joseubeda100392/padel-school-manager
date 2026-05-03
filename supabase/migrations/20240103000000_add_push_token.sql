-- Añadir columna push_token a users para notificaciones push de Expo
alter table users add column if not exists push_token text;

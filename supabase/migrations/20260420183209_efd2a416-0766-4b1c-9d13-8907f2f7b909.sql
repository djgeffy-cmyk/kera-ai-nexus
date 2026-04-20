-- Cria bucket público pra vídeos de fundo da Kera (acessível de qualquer origem, web ou desktop)
insert into storage.buckets (id, name, public)
values ('kera-videos', 'kera-videos', true)
on conflict (id) do nothing;

-- Política: qualquer um pode ler (vídeos são públicos)
create policy "Public read kera-videos"
on storage.objects for select
using (bucket_id = 'kera-videos');

-- Política: apenas admins podem inserir/atualizar/deletar
create policy "Admins can upload kera-videos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'kera-videos' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can update kera-videos"
on storage.objects for update
to authenticated
using (bucket_id = 'kera-videos' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete kera-videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'kera-videos' and public.has_role(auth.uid(), 'admin'));
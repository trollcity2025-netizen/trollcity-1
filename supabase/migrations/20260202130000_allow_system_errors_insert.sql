create policy "Enable insert for authenticated users"
on "public"."system_errors"
as permissive
for insert
to authenticated
with check (true);

create or replace function auto_approve_troller()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'troller' then
    new.status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_auto_approve_troller on applications;
create trigger applications_auto_approve_troller
before insert on applications
for each row execute procedure auto_approve_troller();

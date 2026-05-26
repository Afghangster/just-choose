create or replace function private.generate_connection_invite_code()
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generated_code text := '';
  byte_values bytea := extensions.gen_random_bytes(12);
  index integer;
begin
  for index in 0..11 loop
    generated_code := generated_code || substr(alphabet, (get_byte(byte_values, index) % length(alphabet)) + 1, 1);
  end loop;

  return generated_code;
end;
$$;

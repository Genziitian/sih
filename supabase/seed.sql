-- Reference data. The screening queue itself is generated in the browser on
-- first run, so a fresh Supabase project only needs the sites.

insert into public.sites (id, name, volume, rejection_rate) values
  ('vellore',    'Vellore PHC',     342, 0.0420),
  ('katpadi',    'Katpadi Camp',    218, 0.0980),
  ('ranipet',    'Ranipet PHC',     187, 0.1210),
  ('gudiyatham', 'Gudiyatham Camp', 154, 0.1540),
  ('arakkonam',  'Arakkonam PHC',   131, 0.0670),
  ('ambur',      'Ambur Camp',       96, 0.1110)
on conflict (id) do update
  set name = excluded.name,
      volume = excluded.volume,
      rejection_rate = excluded.rejection_rate;

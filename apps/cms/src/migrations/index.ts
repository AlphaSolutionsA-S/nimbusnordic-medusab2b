import * as migration_20260811_104814_initial_schema from './20260811_104814_initial_schema';
import * as migration_20260919_131145_security_upgrade from './20260919_131145_security_upgrade';

export const migrations = [
  {
    up: migration_20260811_104814_initial_schema.up,
    down: migration_20260811_104814_initial_schema.down,
    name: '20260811_104814_initial_schema',
  },
  {
    up: migration_20260919_131145_security_upgrade.up,
    down: migration_20260919_131145_security_upgrade.down,
    name: '20260919_131145_security_upgrade'
  },
];

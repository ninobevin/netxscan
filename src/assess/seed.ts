import {
  BASELINE_ASSESS,
  DC_ASSESS,
  FIREWALL_ASSESS,
  LOCAL_USERS_ASSESS,
  LOGGED_IN_ASSESS,
  SOFTWARE_ASSESS,
  SOFTWARE_REMEDIATE,
  UPDATES_ASSESS,
  UPDATES_REMEDIATE,
} from './seed-scripts';
import { insertBuiltinIfMissing } from './repository';

export async function seedBuiltinModules(): Promise<void> {
  await insertBuiltinIfMissing(
    'security_baseline',
    'Baseline findings',
    'PASS / WARN / FAIL security baseline',
    BASELINE_ASSESS,
    null,
    null,
  );
  await insertBuiltinIfMissing(
    'installed_software',
    'Installed software',
    'Installed programs with uninstall and update',
    SOFTWARE_ASSESS,
    SOFTWARE_REMEDIATE,
    null,
  );
  await insertBuiltinIfMissing(
    'security_updates',
    'Security updates',
    'Installed and missing Windows updates',
    UPDATES_ASSESS,
    UPDATES_REMEDIATE,
    null,
  );
  await insertBuiltinIfMissing(
    'firewall',
    'Firewall',
    'Firewall profiles and policy summary',
    FIREWALL_ASSESS,
    null,
    null,
  );
  await insertBuiltinIfMissing(
    'local_users',
    'Local users',
    'Enabled and disabled local accounts',
    LOCAL_USERS_ASSESS,
    null,
    null,
  );
  await insertBuiltinIfMissing(
    'logged_in_user',
    'Logged-in user',
    'Interactive logon sessions',
    LOGGED_IN_ASSESS,
    null,
    null,
  );
  await insertBuiltinIfMissing(
    'domain_controller',
    'Domain controller',
    'Which DC this host uses',
    DC_ASSESS,
    null,
    null,
  );
}

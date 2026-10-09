import * as apiKeys from './20261009_031500_api_keys.js'
import * as userRoles from './20261009_060000_user_roles.js'

export const migrations = [
  { up: apiKeys.up, down: apiKeys.down, name: '20261009_031500_api_keys' },
  { up: userRoles.up, down: userRoles.down, name: '20261009_060000_user_roles' },
]

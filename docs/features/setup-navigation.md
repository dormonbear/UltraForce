# Setup Navigation

Jump directly to Setup pages using the `:g` command.

## Usage

```
:g [page]
```

## Examples

```
:g setup          # Setup home
:g users          # Users list
:g profiles       # Profiles list
:g objects        # Object Manager
:g apex           # Apex Classes
```

## Available Pages

### User Management

| Query | Page |
|-------|------|
| `users` | Users list |
| `profiles` | Profiles |
| `permsets` | Permission Sets |
| `roles` | Roles |
| `queues` | Queues |
| `groups` | Public Groups |

### Development

| Query | Page |
|-------|------|
| `apex` | Apex Classes |
| `triggers` | Apex Triggers |
| `vf` | Visualforce Pages |
| `lwc` | Lightning Components |
| `flows` | Flows |

### Objects

| Query | Page |
|-------|------|
| `objects` | Object Manager |
| `fields` | Fields & Relationships |
| `layouts` | Page Layouts |
| `validation` | Validation Rules |

### Security

| Query | Page |
|-------|------|
| `sharing` | Sharing Settings |
| `security` | Security Controls |
| `session` | Session Settings |

### Other

| Query | Page |
|-------|------|
| `setup` | Setup Home |
| `company` | Company Information |
| `deploy` | Deployment Status |
| `jobs` | Apex Jobs |

## Fuzzy Matching

Setup navigation supports fuzzy matching:

```
:g usr            # Matches "users"
:g prof           # Matches "profiles"
:g apx            # Matches "apex"
```

## Tips

- Queries are case-insensitive
- Partial matches work (e.g., `use` matches `users`)
- Most common Setup pages are indexed

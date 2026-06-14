# UltraForce E2E Test Guide

## Test Environment

### Target Org: ultraforce
- **Username**: `<YOUR_TEST_USERNAME>` (configure via `sf org display --target-org ultraforce`)
- **Instance**: `<YOUR_INSTANCE>.develop.my.salesforce.com`
- **Data Source**: [trailheadapps/agent-script-recipes](https://github.com/trailheadapps/agent-script-recipes)

### SF CLI Commands for Verification
```bash
# Display org info
sf org display --target-org ultraforce --json

# Query metadata
sf data query --query "SELECT ..." --target-org ultraforce --json

# Tooling API queries
sf data query --query "SELECT ..." --target-org ultraforce --use-tooling-api --json
```

---

## Available Test Data

### Apex Classes (24 total)
| Name | Description |
|------|-------------|
| WeatherService | Weather API service |
| WeatherAlertService | Weather alert handling |
| PaymentGatewayController | Payment processing |
| ExperienceController | Experience management |
| PersonalizedGuestExperiences | Guest personalization |
| ActionCallbacksFlowTest | Flow test class |
| ActionDefinitionsFlowTest | Flow test class |
| ErrorHandlingFlowTest | Error handling tests |

**Verification Query:**
```bash
sf data query --query "SELECT Id, Name FROM ApexClass WHERE Name = 'WeatherService'" --target-org ultraforce --json
```

### Custom Objects (ASR Package)
| API Name | Label | Description |
|----------|-------|-------------|
| ASR_Agent_Event_Log__c | Agent Event Log | Logs agent events |
| ASR_Customer_Interest__c | ASR Customer Interest | Customer interests |
| ASR_Experience__c | ASR Experience | Experience records |
| ASR_Car_Rental__c | Car Rental | Car rental bookings |
| ASR_Cart_Item__c | Cart Item | Shopping cart items |
| ASR_Customer_Onboarding__c | Customer Onboarding | Onboarding records |
| ASR_Financial_Account__c | Financial Account | Financial data |
| ASR_Flight_Booking__c | Flight Booking | Flight reservations |
| ASR_Hotel__c | Hotel | Hotel information |
| ASR_Hotel_Booking__c | Hotel Booking | Hotel reservations |
| ASR_Itinerary__c | Itinerary | Travel itineraries |
| ASR_Order__c | Order Custom | Order records |
| ASR_Payment_Transaction__c | Payment Transaction | Payment records |
| ASR_Product__c | Product | Product catalog |

**Verification Query:**
```bash
sf data query --query "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE QualifiedApiName LIKE 'ASR_%'" --target-org ultraforce --json
```

### Flows (20+ available)
| DeveloperName | Description |
|---------------|-------------|
| AddToCart | Add items to cart |
| AnalyzeBillingIssue | Billing issue analysis |
| AnalyzeTechnicalIssue | Technical support |
| AssessChurnRisk | Customer churn risk |
| AwardLoyaltyPoints | Loyalty program |
| CalculateCustomerValue | Customer value calc |
| ConfigureAccountSettings | Account setup |
| CreateBooking | Booking creation |
| CreateCase | Case creation |
| CreateCustomerAccount | Account creation |
| CreateEscalationTicket | Escalation handling |
| ExecuteTransfer | Transfer execution |
| FetchAccountData | Account data retrieval |
| FetchOrderHistory | Order history |
| FetchSupportHistory | Support history |
| FetchUserProfile | User profile data |
| FinalizeOnboarding | Onboarding completion |
| GenerateRecommendations | AI recommendations |
| GenerateReport | Report generation |
| GetAccountBalance | Balance inquiry |

**Verification Query:**
```bash
sf data query --query "SELECT Id, DeveloperName FROM FlowDefinition WHERE DeveloperName = 'CreateCase'" --target-org ultraforce --use-tooling-api --json
```

### Users
| Name | Username | ID |
|------|----------|-----|
| Test Admin | `<admin-username>` | `<admin-user-id>` |
| Integration User | `<integration-username>` | `<integration-user-id>` |

**Verification Query:**
```bash
sf data query --query "SELECT Id, Name, Username FROM User WHERE IsActive = true" --target-org ultraforce --json
```

### Profiles
| Name | ID |
|------|-----|
| System Administrator | (query for Id) |
| Standard User | (query for Id) |
| Chatter Free User | (query for Id) |
| Contract Manager | (query for Id) |

**Verification Query:**
```bash
sf data query --query "SELECT Id, Name FROM Profile WHERE Name = 'System Administrator'" --target-org ultraforce --json
```

### Permission Sets
| Name | Label |
|------|-------|
| CopilotSalesforceUser | Access Agentforce Default Agent |
| AgentPlatformBuilder | Agent Platform Builder |
| CDPDataAwareSpecialist | (Legacy) Data Cloud Data Aware Specialist |

**Verification Query:**
```bash
sf data query --query "SELECT Id, Name, Label FROM PermissionSet WHERE Name = 'AgentPlatformBuilder'" --target-org ultraforce --json
```

---

## Test Case Design

### 1. Search Command Tests

#### Object Search (:o)
```typescript
// Search for ASR custom objects
test('Search ASR objects', async () => {
  await openModal()
  await clearAndType(':o ASR')
  // Expect: ASR_Hotel__c, ASR_Order__c, etc.
})

// Verify with SF CLI
// sf data query --query "SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE 'ASR_%'" --target-org ultraforce --json
```

#### Apex Search (:c)
```typescript
// Search for Weather classes
test('Search Weather apex classes', async () => {
  await openModal()
  await clearAndType(':c Weather')
  // Expect: WeatherService, WeatherAlertService, WeatherServiceTest, WeatherAlertServiceTest
})

// Verify with SF CLI
// sf data query --query "SELECT Id, Name FROM ApexClass WHERE Name LIKE 'Weather%'" --target-org ultraforce --json
```

#### Flow Search (:f)
```typescript
// Search for Create flows
test('Search Create flows', async () => {
  await openModal()
  await clearAndType(':f Create')
  // Expect: CreateBooking, CreateCase, CreateCustomerAccount, CreateEscalationTicket
})

// Verify with SF CLI
// sf data query --query "SELECT DeveloperName FROM FlowDefinition WHERE DeveloperName LIKE 'Create%'" --target-org ultraforce --use-tooling-api --json
```

#### User Search (:u)
```typescript
// Search for Dormon user
test('Search Dormon user', async () => {
  await openModal()
  await clearAndType(':u Dormon')
  // Expect: Dormon Zhou
})

// Verify with SF CLI
// sf data query --query "SELECT Id, Name FROM User WHERE Name LIKE '%Dormon%'" --target-org ultraforce --json
```

#### Profile Search (:p)
```typescript
// Search for Admin profile
test('Search Admin profile', async () => {
  await openModal()
  await clearAndType(':p Admin')
  // Expect: System Administrator
})
```

### 2. Navigation Tests

#### Apex Class Navigation
```typescript
test('Navigate to WeatherService class', async () => {
  // Search and navigate
  await testNewTabNavigation(':c WeatherService', /ApexClasses|01p/, 'WeatherService')

  // Verify ID exists
  // sf data query --query "SELECT Id FROM ApexClass WHERE Name = 'WeatherService'" --target-org ultraforce --json
  // Expected: ID starts with 01p prefix
})
```

#### Custom Object Navigation
```typescript
test('Navigate to ASR_Hotel__c object', async () => {
  await testNewTabNavigation(':o ASR_Hotel', /ASR_Hotel|lightning\/o/, 'ASR Hotel')
})
```

#### Flow Navigation
```typescript
test('Navigate to CreateCase flow', async () => {
  await testNewTabNavigation(':f CreateCase', /flowBuilder|300/, 'CreateCase Flow')

  // Verify Flow ID
  // sf data query --query "SELECT Id FROM FlowDefinition WHERE DeveloperName = 'CreateCase'" --target-org ultraforce --use-tooling-api --json
  // Expected: ID starts with 300 prefix
})
```

### 3. Field Search Tests (Dot Notation)

```typescript
test('Search ASR_Hotel__c fields', async () => {
  await openModal()
  await clearAndType('ASR_Hotel__c.')
  // Expect: Custom fields on ASR_Hotel__c object
})

// Verify with SF CLI
// sf data query --query "SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'ASR_Hotel__c'" --target-org ultraforce --use-tooling-api --json
```

### 4. Result Verification Pattern

Each test should follow this pattern:
1. **Search**: Use UltraForce to search for metadata
2. **Navigate**: Click/Enter to navigate to the result
3. **Verify URL**: Check that new tab URL matches expected pattern
4. **Verify with SF CLI**: Run sf query to confirm metadata exists

```typescript
async function verifySearchResult(
  command: string,
  expectedPattern: RegExp,
  sfQuery: string
): Promise<void> {
  // 1. Search and navigate
  const result = await testNewTabNavigation(command, expectedPattern, command)
  expect(result).toBe(true)

  // 2. SF CLI verification happens in test setup/fixtures
}
```

---

## SF CLI Verification Scripts

### Pre-test Data Verification
```bash
#!/bin/bash
# verify-test-data.sh

echo "Verifying Apex Classes..."
sf data query --query "SELECT COUNT() FROM ApexClass WHERE NamespacePrefix = null" --target-org ultraforce --json

echo "Verifying Custom Objects..."
sf data query --query "SELECT COUNT() FROM EntityDefinition WHERE QualifiedApiName LIKE 'ASR_%'" --target-org ultraforce --json

echo "Verifying Flows..."
sf data query --query "SELECT COUNT() FROM FlowDefinition" --target-org ultraforce --use-tooling-api --json

echo "Verifying Users..."
sf data query --query "SELECT COUNT() FROM User WHERE IsActive = true" --target-org ultraforce --json
```

### ID Extraction for Test Assertions
```bash
# Get specific IDs for test assertions
sf data query --query "SELECT Id, Name FROM ApexClass WHERE Name IN ('WeatherService', 'PaymentGatewayController', 'ExperienceController')" --target-org ultraforce --json | jq '.result.records'
```

---

## Test Execution

### Run All E2E Tests
```bash
pnpm exec playwright test --headed
```

### Run Specific Test
```bash
pnpm exec playwright test -g "Navigate to WeatherService" --headed
```

### Debug Mode
```bash
pnpm exec playwright test --headed --debug
```

---

## Navigation Mode URL Patterns

The extension supports two navigation modes: **Lightning** (default) and **Classic**.

### Lightning Experience URLs

| Type | URL Pattern | Example |
|------|-------------|---------|
| ApexClass | `/lightning/setup/ApexClasses/page?address=%2F{id}` | `/lightning/setup/ApexClasses/page?address=%2F01pXXXXXXXXXXXXXXX` |
| ApexTrigger | `/lightning/setup/ApexTriggers/page?address=%2F{id}` | `/lightning/setup/ApexTriggers/page?address=%2F01qxxxxx` |
| User | `/lightning/setup/ManageUsers/page?address=%2F{id}` | `/lightning/setup/ManageUsers/page?address=%2F005XXXXXXXXXXXXXXXXX` |
| CustomObject | `/lightning/o/{apiName}/list` | `/lightning/o/ASR_Hotel__c/list` |
| CustomField | `/lightning/setup/ObjectManager/{obj}/FieldsAndRelationships/{fieldId}/view` | |
| Flow | `/builder_platform_interaction/flowBuilder.app?flowId={id}` | `/flowBuilder.app?flowId=300XXXXXXXXXXXXXXXXX` |
| PermissionSet | `/lightning/setup/PermSets/page?address=%2F{id}` | |
| Profile | `/lightning/setup/EnhancedProfiles/page?address=%2F{id}` | |
| Queue | `/lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D{id}` | |

### Classic URLs

| Type | URL Pattern | Example |
|------|-------------|---------|
| ApexClass | `/{id}` | `/01pXXXXXXXXXXXXXXX` |
| ApexTrigger | `/{id}` | `/01qxxxxx` |
| User | `/{id}` | `/005XXXXXXXXXXXXXXXXX` |
| CustomObject | `/{keyPrefix}` or `/p/setup/layout/LayoutFieldList?type={apiName}` | `/a0B` |
| CustomField | `/{fieldId}` | `/00Nxxxxx` |
| Flow | `/builder_platform_interaction/flowBuilder.app?flowId={id}` | Same as Lightning |
| PermissionSet | `/{id}` | `/0PSxxxxx` |
| Profile | `/{id}` | `/00exxxxx` |
| Queue | `/p/own/Queue/d?id={id}&setupid=Queues` | |

### Setup Shortcuts (:g)
Setup shortcuts always use Lightning URLs regardless of navigation mode setting:

| Shortcut | URL |
|----------|-----|
| `:g users` | `/lightning/setup/ManageUsers/home` |
| `:g apex` | `/lightning/setup/ApexClasses/home` |
| `:g debug` | `/lightning/setup/DebugLogs/home` |
| `:g permission` | `/lightning/setup/PermSets/home` |
| `:g profiles` | `/lightning/setup/Profiles/home` |

---

## Notes

1. **Chrome Extension Limitation**: Tests must run in headed mode (`headless: false`) because Chrome extensions cannot load in headless mode.

2. **Navigation Behavior**: All result clicks use `window.open(url, '_blank')` to open in new tabs.

3. **Wait Times**: API calls to Salesforce may require adequate wait times (2-3 seconds) for results to load.

4. **Closed Shadow DOM**: The extension uses closed shadow DOM, so internal elements cannot be directly queried. Tests interact via keyboard events.

5. **Navigation Mode**: Default is Lightning. Classic mode can be set in Settings panel. Tests should verify correct URL patterns for each mode.

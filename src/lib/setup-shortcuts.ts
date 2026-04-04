export interface SetupShortcut {
  id: string
  name: string
  description: string
  path: string
  classicPath?: string
}

export const SETUP_SHORTCUTS: SetupShortcut[] = [
  // Process Automation
  { id: 'approval-processes', name: 'Approval Processes', description: 'Process Automation', path: '/lightning/setup/ApprovalProcesses/home', classicPath: '/setup/workflow/approval' },
  { id: 'flows', name: 'Flows', description: 'Process Automation', path: '/lightning/setup/Flows/home' },
  { id: 'workflow-rules', name: 'Workflow Rules', description: 'Process Automation', path: '/lightning/setup/WorkflowRules/home', classicPath: '/setup/workflow/rules' },

  // Security
  { id: 'session-settings', name: 'Session Settings', description: 'Security', path: '/lightning/setup/SecuritySession/home', classicPath: '/_ui/system/security/SessionSettings' },
  { id: 'password-policies', name: 'Password Policies', description: 'Security', path: '/lightning/setup/SecurityPolicies/home', classicPath: '/secur/orgloginsettingedit.jsp' },
  { id: 'sharing-settings', name: 'Sharing Settings', description: 'Security', path: '/lightning/setup/SecuritySharing/home', classicPath: '/p/own/OrgSharingDetail' },
  { id: 'remote-site-settings', name: 'Remote Site Settings', description: 'Security', path: '/lightning/setup/SecurityRemoteProxy/home', classicPath: '/0rp' },
  { id: 'named-credentials', name: 'Named Credentials', description: 'Security', path: '/lightning/setup/NamedCredential/home', classicPath: '/0XA' },
  { id: 'cors', name: 'CORS', description: 'Security', path: '/lightning/setup/CorsWhitelistEntries/home', classicPath: '/074' },
  { id: 'trusted-urls', name: 'Trusted URLs', description: 'Security', path: '/lightning/setup/SecurityCspTrustedSite/home', classicPath: '/08y' },
  { id: 'health-check', name: 'Health Check', description: 'Security', path: '/lightning/setup/HealthCheck/home', classicPath: '/_ui/security/dashboard/aura/SecurityDashboardAuraContainer' },
  { id: 'setup-audit-trail', name: 'Setup Audit Trail', description: 'Security', path: '/lightning/setup/SecurityEvents/home', classicPath: '/setup/org/orgsetupaudit.jsp' },
  { id: 'certificates', name: 'Certificates', description: 'Security', path: '/lightning/setup/CertificatesAndKeysManagement/home', classicPath: '/0P1' },

  // Identity
  { id: 'login-history', name: 'Login History', description: 'Identity', path: '/lightning/setup/OrgLoginHistory/home', classicPath: '/0Ya' },
  { id: 'sso-settings', name: 'Single Sign-On', description: 'Identity', path: '/lightning/setup/SingleSignOn/home', classicPath: '/_ui/identity/saml/SingleSignOnSettingsUi/d' },
  { id: 'auth-providers', name: 'Auth Providers', description: 'Identity', path: '/lightning/setup/AuthProviders/home', classicPath: '/0SO' },
  { id: 'oauth-settings', name: 'OAuth Settings', description: 'Identity', path: '/lightning/setup/OauthOidcSettings/home', classicPath: '/_ui/security/OauthOidcSettings/aura/OauthOidcSettingsAuraContainer' },

  // User Management
  { id: 'users', name: 'Users', description: 'User Management', path: '/lightning/setup/ManageUsers/home', classicPath: '/005?isUserEntityOverride=1' },
  { id: 'permission-sets', name: 'Permission Sets', description: 'User Management', path: '/lightning/setup/PermSets/home', classicPath: '/0PS' },
  { id: 'permission-set-groups', name: 'Permission Set Groups', description: 'User Management', path: '/lightning/setup/PermSetGroups/home', classicPath: '/_ui/perms/ui/setup/PermSetGroupsPage' },
  { id: 'profiles', name: 'Profiles', description: 'User Management', path: '/lightning/setup/EnhancedProfiles/home', classicPath: '/00e' },
  { id: 'roles', name: 'Roles', description: 'User Management', path: '/lightning/setup/Roles/home', classicPath: '/setup/user/roleSplash.jsp' },
  { id: 'queues', name: 'Queues', description: 'User Management', path: '/lightning/setup/Queues/home', classicPath: '/p/own/OrgQueuesPage/d' },
  { id: 'public-groups', name: 'Public Groups', description: 'User Management', path: '/lightning/setup/PublicGroups/home', classicPath: '/p/own/OrgPublicGroupsPage/d' },

  // Company Settings
  { id: 'company-information', name: 'Company Information', description: 'Company Settings', path: '/lightning/setup/CompanyProfileInfo/home', classicPath: '/setup/companyInfo.apexp' },
  { id: 'my-domain', name: 'My Domain', description: 'Company Settings', path: '/lightning/setup/OrgDomain/home' },

  // Apps
  { id: 'app-manager', name: 'App Manager', description: 'Apps', path: '/lightning/setup/NavigationMenus/home', classicPath: '/02u' },
  { id: 'connected-apps', name: 'Connected Apps', description: 'Apps', path: '/lightning/setup/ConnectedApplication/home' },

  // Custom Code / Development
  { id: 'apex-classes', name: 'Apex Classes', description: 'Custom Code', path: '/lightning/setup/ApexClasses/home', classicPath: '/01p' },
  { id: 'apex-triggers', name: 'Apex Triggers', description: 'Custom Code', path: '/lightning/setup/ApexTriggers/home', classicPath: '/setup/build/allTriggers.apexp' },
  { id: 'apex-settings', name: 'Apex Settings', description: 'Custom Code', path: '/lightning/setup/ApexSettings/home', classicPath: '/setup/apexsettings.apexp' },
  { id: 'apex-test-execution', name: 'Apex Test Execution', description: 'Custom Code', path: '/lightning/setup/ApexTestQueue/home', classicPath: '/ui/setup/apex/ApexTestQueuePage' },
  { id: 'visualforce-pages', name: 'Visualforce Pages', description: 'Custom Code', path: '/lightning/setup/ApexPages/home', classicPath: '/apexpages/setup/listApexPage.apexp' },
  { id: 'visualforce-components', name: 'Visualforce Components', description: 'Custom Code', path: '/lightning/setup/ApexComponents/home', classicPath: '/apexpages/setup/listApexComponent.apexp' },
  { id: 'lightning-components', name: 'Lightning Components', description: 'Custom Code', path: '/lightning/setup/LightningComponentBundles/home' },
  { id: 'static-resources', name: 'Static Resources', description: 'Custom Code', path: '/lightning/setup/StaticResources/home', classicPath: '/apexpages/setup/listStaticResource.apexp' },
  { id: 'custom-metadata-types', name: 'Custom Metadata Types', description: 'Custom Code', path: '/lightning/setup/CustomMetadata/home', classicPath: '/_ui/platform/ui/schema/wizard/entity/CustomMetadataTypeListPage' },
  { id: 'custom-settings', name: 'Custom Settings', description: 'Custom Code', path: '/lightning/setup/CustomSettings/home', classicPath: '/setup/ui/listCustomSettings.apexp' },
  { id: 'platform-cache', name: 'Platform Cache', description: 'Custom Code', path: '/lightning/setup/PlatformCache/home', classicPath: '/0Er' },

  // Integrations
  { id: 'platform-events', name: 'Platform Events', description: 'Integrations', path: '/lightning/setup/EventObjects/home', classicPath: '/p/setup/custent/EventObjectsPage' },
  { id: 'external-services', name: 'External Services', description: 'Integrations', path: '/lightning/setup/ExternalServices/home' },
  { id: 'data-loader', name: 'Data Loader', description: 'Integrations', path: '/lightning/setup/DataLoader/home' },
  { id: 'data-import-wizard', name: 'Data Import Wizard', description: 'Integrations', path: '/lightning/setup/DataManagementDataImporter/home', classicPath: '/ui/setup/dataimporter/DataImporterLandingPage' },

  // Logs & Monitoring
  { id: 'debug-logs', name: 'Debug Logs', description: 'Logs & Monitoring', path: '/lightning/setup/ApexDebugLogs/home', classicPath: '/setup/ui/listApexTraces.apexp' },
  { id: 'apex-jobs', name: 'Apex Jobs', description: 'Logs & Monitoring', path: '/lightning/setup/AsyncApexJobs/home', classicPath: '/apexpages/setup/listAsyncApexJobs.apexp' },
  { id: 'scheduled-jobs', name: 'Scheduled Jobs', description: 'Logs & Monitoring', path: '/lightning/setup/ScheduledJobs/home', classicPath: '/08e' },
  { id: 'bulk-data-load-jobs', name: 'Bulk Data Load Jobs', description: 'Logs & Monitoring', path: '/lightning/setup/AsyncApiJobStatus/home', classicPath: '/750' },

  // Environments
  { id: 'deployment-status', name: 'Deployment Status', description: 'Environments', path: '/lightning/setup/DeployStatus/home', classicPath: '/changemgmt/monitorDeployment.apexp' },
  { id: 'sandboxes', name: 'Sandboxes', description: 'Environments', path: '/lightning/setup/DataManagementCreateTestInstance/home' },
  { id: 'system-overview', name: 'System Overview', description: 'Environments', path: '/lightning/setup/SystemOverview/home', classicPath: '/setup/systemOverview.apexp' },

  // Communication
  { id: 'email-deliverability', name: 'Email Deliverability', description: 'Communication', path: '/lightning/setup/OrgEmailSettings/home' },
  { id: 'email-templates', name: 'Email Templates', description: 'Communication', path: '/lightning/setup/CommunicationTemplatesEmail/home' },

  // Automation Rules
  { id: 'lead-assignment-rules', name: 'Lead Assignment Rules', description: 'Automation', path: '/lightning/setup/LeadRules/home' },
  { id: 'case-assignment-rules', name: 'Case Assignment Rules', description: 'Automation', path: '/lightning/setup/CaseRules/home' }
]

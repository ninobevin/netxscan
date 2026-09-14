export type CatalogControl = { code: string; title: string };
export type CatalogFamily = { code: string; title: string; controls: CatalogControl[] };
export type CatalogDomain = { code: string; name: string; families: CatalogFamily[] };

export const ADHICS_CATALOG_VERSION = 'v2';

export const ADHICS_CATALOG_V2: CatalogDomain[] = [
  {
    code: '1',
    name: 'Human Resource Security',
    families: [
      {
        code: 'HR 1',
        title: 'Human Resources Security Policy',
        controls: [{ code: 'HR 1.1', title: 'Human Resources Security Policy' }],
      },
      {
        code: 'HR 2',
        title: 'Prior to Employment',
        controls: [
          { code: 'HR 2.1', title: 'Background Verification' },
          { code: 'HR 2.2', title: 'Terms and Conditions of Employment' },
        ],
      },
      {
        code: 'HR 3',
        title: 'During Employment',
        controls: [
          { code: 'HR 3.1', title: 'Establishing Policies and Procedures' },
          { code: 'HR 3.2', title: 'Awareness Program' },
          { code: 'HR 3.3', title: 'Awareness and Training' },
          { code: 'HR 3.4', title: 'Role Based Training' },
          { code: 'HR 3.5', title: 'Disciplinary Procedure' },
        ],
      },
      {
        code: 'HR 4',
        title: 'Termination or Change of Employment and Role',
        controls: [
          { code: 'HR 4.1', title: 'Termination Responsibility' },
          { code: 'HR 4.2', title: 'Return of Assets' },
          { code: 'HR 4.3', title: 'Removal of Access Rights' },
          { code: 'HR 4.4', title: 'Internal Transfers and Change of Role' },
        ],
      },
    ],
  },
  {
    code: '2',
    name: 'Asset Management',
    families: [
      {
        code: 'AM 1',
        title: 'Asset Management Policy',
        controls: [
          { code: 'AM 1.1', title: 'Asset Management Policy' },
          { code: 'AM 1.2', title: 'Allocation of Medical Assets' },
        ],
      },
      {
        code: 'AM 2',
        title: 'Management of Assets',
        controls: [
          { code: 'AM 2.1', title: 'Asset Inventory' },
          { code: 'AM 2.2', title: 'Asset Relationship' },
          { code: 'AM 2.3', title: 'Asset Ownership' },
          { code: 'AM 2.4', title: 'Acceptable Use of Assets' },
          { code: 'AM 2.5', title: 'Acceptable Bring Your Own Device Arrangements (BYOD)' },
        ],
      },
      {
        code: 'AM 3',
        title: 'Asset Classification & Labelling',
        controls: [
          { code: 'AM 3.1', title: 'Information Classification' },
          { code: 'AM 3.2', title: 'Interpretation of External Entities Classification Scheme' },
          { code: 'AM 3.3', title: 'Asset Tagging' },
        ],
      },
      {
        code: 'AM 4',
        title: 'Asset Handling',
        controls: [
          { code: 'AM 4.1', title: 'Handling Procedures' },
          { code: 'AM 4.2', title: 'Management of Removable Media' },
          { code: 'AM 4.3', title: 'Access Allocation for Medical Devices' },
          { code: 'AM 4.4', title: 'Security of Information within Medical Devices' },
          { code: 'AM 4.5', title: 'Communication Facility for Medical Devices' },
          { code: 'AM 4.6', title: 'Removable Media Security' },
          { code: 'AM 4.7', title: 'Removal and Movement of Information Assets' },
        ],
      },
      {
        code: 'AM 5',
        title: 'Asset Disposal',
        controls: [
          { code: 'AM 5.1', title: 'Information Asset Secure Disposal' },
          { code: 'AM 5.2', title: 'Records on Disposal' },
        ],
      },
    ],
  },
  {
    code: '3',
    name: 'Physical and Environmental Security',
    families: [
      {
        code: 'PE 1',
        title: 'Physical and Environmental Security Policy',
        controls: [{ code: 'PE 1.1', title: 'Physical and Environmental Security Policy' }],
      },
      {
        code: 'PE 2',
        title: 'Secure Areas',
        controls: [
          { code: 'PE 2.1', title: 'Physical Security Perimeter' },
          { code: 'PE 2.2', title: 'Private Areas' },
          { code: 'PE 2.3', title: 'Secure Areas Control Measures' },
          { code: 'PE 2.4', title: 'Ownership of Secure Areas' },
          { code: 'PE 2.5', title: 'Protection against External & Environmental Threats' },
          { code: 'PE 2.6', title: 'Delivery and Loading Areas' },
        ],
      },
      {
        code: 'PE 3',
        title: 'Equipment Security',
        controls: [
          { code: 'PE 3.1', title: 'Equipment Siting and Protection' },
          { code: 'PE 3.2', title: 'Standard Operating Procedure for Equipment' },
          { code: 'PE 3.3', title: 'Cabling Security' },
          { code: 'PE 3.4', title: 'Security of Equipment Off Site' },
          { code: 'PE 3.5', title: 'Clear Desk & Clear Screen Policy' },
        ],
      },
    ],
  },
  {
    code: '4',
    name: 'Access Control',
    families: [
      {
        code: 'AC 1',
        title: 'Access Control Policy',
        controls: [{ code: 'AC 1.1', title: 'Access Control Policy' }],
      },
      {
        code: 'AC 2',
        title: 'User Access Management',
        controls: [
          { code: 'AC 2.1', title: 'User Registration and De-Registration' },
          { code: 'AC 2.2', title: 'Privilege Management' },
          { code: 'AC 2.3', title: 'Use and Management of Security Credential' },
        ],
      },
      {
        code: 'AC 3',
        title: 'Equipment and Devices Access Control',
        controls: [
          { code: 'AC 3.1', title: 'Access Control for Portable and Medical Devices' },
          { code: 'AC 3.2', title: 'Access Control for Assets and Equipment in Teleworking Sites' },
          { code: 'AC 3.3', title: 'Telehealth Security' },
        ],
      },
      {
        code: 'AC 4',
        title: 'Access Reviews',
        controls: [{ code: 'AC 4.1', title: 'Review of User Access Rights' }],
      },
      {
        code: 'AC 5',
        title: 'Network Access Control',
        controls: [
          { code: 'AC 5.1', title: 'Access to Network and Network Services' },
          { code: 'AC 5.2', title: 'Equipment Identification in Network' },
          { code: 'AC 5.3', title: 'Remote Diagnostic and Configuration Protection' },
          { code: 'AC 5.4', title: 'Network Routing Control' },
          { code: 'AC 5.5', title: 'Wireless Access' },
        ],
      },
      {
        code: 'AC 6',
        title: 'Operating System Access Control',
        controls: [
          { code: 'AC 6.1', title: 'Secure Log-On Procedures' },
          { code: 'AC 6.2', title: 'User Identification and Authentication' },
          { code: 'AC 6.3', title: 'Use of System Utilities' },
        ],
      },
    ],
  },
  {
    code: '5',
    name: 'Communications and Operations Management',
    families: [
      {
        code: 'CO 1',
        title: 'Communications and Operations Management Policy',
        controls: [{ code: 'CO 1.1', title: 'Communications and Operations Management Policy' }],
      },
      {
        code: 'CO 2',
        title: 'Operational Procedures and Responsibilities',
        controls: [
          { code: 'CO 2.1', title: 'Baseline Configuration' },
          { code: 'CO 2.2', title: 'Documented Operating Procedure' },
          { code: 'CO 2.3', title: 'Change Management' },
          { code: 'CO 2.6', title: 'Separation of Test, Development and Operational Environment' },
        ],
      },
      {
        code: 'CO 3',
        title: 'Planning and Acceptance',
        controls: [
          { code: 'CO 3.1', title: 'Capacity Management' },
          { code: 'CO 3.2', title: 'System Acceptance and Testing' },
        ],
      },
      {
        code: 'CO 4',
        title: 'Malware Protection',
        controls: [
          { code: 'CO 4.1', title: 'Controls Against Malware' },
          { code: 'CO 4.2', title: 'Gateway Level Protection for Malware' },
        ],
      },
      {
        code: 'CO 5',
        title: 'Backup and Archival',
        controls: [
          { code: 'CO 5.1', title: 'Backup Management' },
          { code: 'CO 5.2', title: 'Archival Requirements' },
        ],
      },
      {
        code: 'CO 6',
        title: 'Logging and Monitoring',
        controls: [
          { code: 'CO 6.1', title: 'Logging and Monitoring Procedures' },
          { code: 'CO 6.2', title: 'Preservation of Log Information' },
          { code: 'CO 6.3', title: 'Clock Synchronization' },
          { code: 'CO 6.4', title: 'Information Leakage' },
        ],
      },
      {
        code: 'CO 7',
        title: 'Security Assessment and Vulnerability Management',
        controls: [
          { code: 'CO 7.1', title: 'Technical Vulnerability Assessment and Penetration Testing' },
          { code: 'CO 7.2', title: 'Security of Assessment Data' },
        ],
      },
      {
        code: 'CO 8',
        title: 'Patch Management',
        controls: [
          { code: 'CO 8.1', title: 'Patch Management Procedure' },
          { code: 'CO 8.2', title: 'Tracking of Patches' },
        ],
      },
      {
        code: 'CO 9',
        title: 'Information Exchange',
        controls: [
          { code: 'CO 9.1', title: 'Information Exchange Procedures' },
          { code: 'CO 9.2', title: 'Secure Practices for Information Exchange' },
          { code: 'CO 9.3', title: 'Information Exchange Agreements' },
          { code: 'CO 9.4', title: 'Physical Media in Transit' },
          { code: 'CO 9.5', title: 'Restrict Usage of Public Domain Email' },
          { code: 'CO 9.6', title: 'Electronic Messaging Protection' },
          { code: 'CO 9.7', title: 'Secure Transfer across Business Information System' },
        ],
      },
      {
        code: 'CO 10',
        title: 'Electronic Commerce',
        controls: [
          { code: 'CO 10.1', title: 'Security of Electronic Commerce Services' },
          { code: 'CO 10.2', title: 'Online Transaction' },
          { code: 'CO 10.3', title: 'Publicly Available Information' },
        ],
      },
      {
        code: 'CO 11',
        title: 'Information Sharing Platforms',
        controls: [{ code: 'CO 11.1', title: 'Connectivity to Information Sharing Platforms' }],
      },
      {
        code: 'CO 12',
        title: 'Network Security Management',
        controls: [
          { code: 'CO 12.1', title: 'Network Controls' },
          { code: 'CO 12.2', title: 'Segregation in Networks' },
          { code: 'CO 12.3', title: 'Security of Wireless Networks' },
        ],
      },
    ],
  },
  {
    code: '6',
    name: 'Data Privacy and Protection',
    families: [
      {
        code: 'DP 1',
        title: 'Privacy and Protection Practices',
        controls: [
          { code: 'DP 1.1', title: 'Data Privacy Policy' },
          { code: 'DP 1.2', title: 'Consent Collection' },
          { code: 'DP 1.3', title: 'Lawful, Fair and Transparent Processing Procedures' },
          { code: 'DP 1.4', title: 'Technical and Organizational Measures' },
          { code: 'DP 1.5', title: 'Data Processing Inventory and Data Privacy Impact Assessment (DPIA)' },
          { code: 'DP 1.6', title: 'Data Processors Security' },
          { code: 'DP 1.7', title: 'Data Breach Management' },
        ],
      },
      {
        code: 'DP 2',
        title: 'Appointment of Data Protection Officer',
        controls: [{ code: 'DP 2.1', title: 'Requirement for Appointing Data Protection Officer' }],
      },
      {
        code: 'DP 3',
        title: 'Data Subject Rights',
        controls: [{ code: 'HI 3.1', title: 'Protection of Data Subject Rights' }],
      },
    ],
  },
  {
    code: '7',
    name: 'Cloud Security',
    families: [
      {
        code: 'CS 1',
        title: 'Cloud Security Policy',
        controls: [
          { code: 'CS 1.1', title: 'Cloud Security Policy' },
          { code: 'CS 1.2', title: 'Cloud Security Controls' },
        ],
      },
    ],
  },
  {
    code: '8',
    name: 'Third Party Security',
    families: [
      {
        code: 'TP 1',
        title: 'Third Party Security Policy',
        controls: [{ code: 'TP 1.1', title: 'Third Party Security Policy' }],
      },
      {
        code: 'TP 2',
        title: 'Third Party Service Delivery and Monitoring',
        controls: [
          { code: 'TP 2.1', title: 'Third-Party Service Delivery Agreements' },
          { code: 'TP 2.2', title: 'Monitoring and Review of Third-Party Services' },
          { code: 'TP 2.3', title: 'Managing Changes to Third Party Services' },
        ],
      },
    ],
  },
  {
    code: '9',
    name: 'Information Systems Acquisition, Development, and Maintenance',
    families: [
      {
        code: 'SA 1',
        title: 'Information Systems Acquisition, Development, and Maintenance Policy',
        controls: [
          {
            code: 'SA 1.1',
            title: 'Information Systems Acquisition, Development and Maintenance Policy',
          },
        ],
      },
      {
        code: 'SA 2',
        title: 'Security Requirement of Information Systems and Applications',
        controls: [
          { code: 'SA 2.1', title: 'Security Requirements Analysis and Specification' },
          { code: 'SA 2.2', title: 'Developer Training' },
          { code: 'SA 2.3', title: 'Correct Processing in Applications' },
          { code: 'SA 2.4', title: 'Off-line Processing Capabilities' },
        ],
      },
      {
        code: 'SA 3',
        title: 'Cryptographic Controls',
        controls: [{ code: 'SA 3.1', title: 'Cryptography and Key Management' }],
      },
      {
        code: 'SA 4',
        title: 'Security of System Files',
        controls: [
          { code: 'SA 4.1', title: 'Control of Operational Software' },
          { code: 'SA 4.2', title: 'Protection of System Test Data and Source Code' },
        ],
      },
      {
        code: 'SA 5',
        title: 'Outsourced Software Development',
        controls: [{ code: 'SA 5.1', title: 'Outsourced Software Development' }],
      },
      {
        code: 'SA 6',
        title: 'Supply Chain Management',
        controls: [
          { code: 'SA 6.1', title: 'Secure Acquisition' },
          { code: 'SA 6.2', title: 'Supply Chain Protection Strategy' },
          { code: 'SA 6.3', title: 'Process to Address Weakness or Deficiency' },
          { code: 'SA 6.4', title: 'Supply of Critical Information System Component' },
        ],
      },
    ],
  },
  {
    code: '10',
    name: 'Information Security Incident Management',
    families: [
      {
        code: 'IM 1',
        title: 'Information Security Incident Policy',
        controls: [{ code: 'IM 1.1', title: 'Information Security Incident Management Policy' }],
      },
      {
        code: 'IM 2',
        title: 'Incident Management and Improvements',
        controls: [
          { code: 'IM 2.1', title: 'Incident Response Procedure' },
          { code: 'IM 2.2', title: 'Computer Security Incident Response Team' },
          { code: 'IM 2.3', title: 'Incident Classification' },
          { code: 'IM 2.4', title: 'Incident Response Testing' },
          { code: 'IM 2.5', title: 'Incident Records' },
        ],
      },
      {
        code: 'IM 3',
        title: 'Information Security Events and Weakness Reporting',
        controls: [{ code: 'IM 3.1', title: 'Situational Awareness' }],
      },
    ],
  },
  {
    code: '11',
    name: 'Information Systems Continuity Management',
    families: [
      {
        code: 'SC 1',
        title: 'Information Systems Continuity Management Policy',
        controls: [{ code: 'SC 1.1', title: 'Information Systems Continuity Management Policy' }],
      },
      {
        code: 'SC 2',
        title: 'Information Systems Continuity Planning',
        controls: [
          { code: 'SC 2.1', title: 'Business Impact Analysis' },
          { code: 'SC 2.2', title: 'Developing Information Systems Continuity Plans' },
          { code: 'SC 2.3', title: 'Testing, Maintaining and Reassessing Plans' },
        ],
      },
    ],
  },
];

4. Electron Security Architecture

The React renderer must not directly execute privileged operating system operations.

The application must use a secure Electron architecture:

Security Requirements

The renderer must not directly access:

Node.js APIs
File system operations
PowerShell
Nmap
WinRM
Windows Credential Manager
Database credentials
Operating system shell

Privileged operations must be exposed through controlled IPC handlers.

Do not enable unrestricted Node.js access in the renderer.

Do not expose arbitrary command execution through IPC.

5. Authentication and Authorization

The application must have a login system.

Users must authenticate before accessing the application.

Basic roles:

Administrator

Can:

Manage users
Configure the system
Perform scans
Perform assessments
Manage vulnerabilities
Manage findings
Generate reports
View audit logs
IT Support/User

Can perform functions according to assigned permissions.

The authorization system should use role-based access control.

Authentication Requirements

The system should implement:

Login
Logout
Password hashing
Session management
Automatic session timeout
Failed-login handling
Role-based access control
Audit logging

Application passwords must never be stored in plaintext.

Passwords should be securely hashed using an established password-hashing algorithm.

6. Credential Management

Windows endpoint credentials must be stored using:

Windows Credential Manager

The actual password must not be stored in MySQL.

The actual password must not appear in:

Source code
.env files
JSON files
Configuration files
Logs
Scan results
Database records

MySQL may contain credential metadata such as:

The actual secret remains in Windows Credential Manager.

7. Network Assessment
Nmap

Nmap will be used for authorized network assessment.

Possible functions:

Host discovery
Port scanning
Service detection
Service version detection
HTTPS/TLS assessment
SSL/TLS cipher assessment
SMB protocol assessment
Selected NSE security scripts

The system must only scan authorized network ranges and devices.

8. Windows Assessment

PowerShell and WinRM will be used for authorized Windows system assessment.

Possible information:

Hostname
IP address
Operating system
OS version
Domain
CPU
RAM
Disk information
Installed software
Windows updates
Windows Firewall status
Microsoft Defender status
BitLocker status
Other approved Windows configuration information

The system must use predefined and controlled commands.

The user interface must not provide unrestricted PowerShell execution.

9. Active Directory Environment

The system is designed to support an Active Directory environment.

For domain-joined computers:

Authorized domain credentials may be used.
Required permissions must be limited.
WinRM must be configured only for authorized assessment.
Firewall rules must restrict access to appropriate sources.
Network routing may be configured between authorized network segments.

For computers that are not domain-joined:

Authorized local administrator credentials may be required.
Only approved assessment functions should be performed.
10. Vulnerability Management

The system will maintain vulnerability information using CVE/NVD data.

CVE information may be obtained through:

Online
Offline

The system should support updating the vulnerability database without requiring Internet access when manual import is used.

11. Vulnerability Correlation

The vulnerability engine should correlate available asset information with vulnerability information.

Example:

The system must avoid claiming that an asset is vulnerable based solely on an open port or service unless sufficient evidence exists.

Findings should contain information such as:

Asset
Finding title
Description
Severity
Source
CVE ID when applicable
Recommendation
First detected
Last detected
Status
12. Findings Management

Finding statuses may include:

Open
Acknowledged
In Progress
Resolved
Accepted Risk
False Positive

The system should allow authorized users to update the status and record relevant notes.

13. Asset Inventory

The system should maintain information about discovered IT assets.

Possible asset information:

Supported asset types may include:

Workstation
Server
Virtual Server
Network Device
Printer
Other supported device
14. Audit Trail

The system must maintain an audit trail of important application activities.

Examples:

Audit logs must not contain passwords or sensitive credentials.

15. Reporting

The system should provide reports for:

Asset inventory
Vulnerability findings
Security assessments
Scan history
Remediation status
Audit activity

Reports should support technical audit preparation and IT management.

16. Modular Development Plan

The project must be developed incrementally.

Do not generate the entire application at once.

Module 1 — Project Foundation

Create:

Electron
React
TypeScript
Tailwind CSS
Basic application structure

Expected result:

No Nmap, PowerShell, WinRM, MySQL, CVE, or vulnerability functionality yet.

Module 2 — Secure Electron IPC

Implement:

Main process
Renderer process
Preload
contextBridge
Controlled IPC

Create a simple IPC test before implementing privileged operations.

Module 3 — Authentication and Authorization

Implement:

Login
Logout
Password hashing
User roles
Session management
Session timeout
Failed-login handling
Module 4 — MySQL Database

Implement:

MySQL connection
Database configuration
Initial migrations
Basic database service

Start with only the required tables.

Module 5 — Asset Data Model

Implement:

Asset model
Asset repository/service
Create asset
Read asset
Update asset
Archive asset
Module 6 — Nmap Integration

Implement a controlled Nmap service.

Architecture:

Start with a basic authorized scan.

Module 7 — Network Discovery

Expand Nmap integration to identify:

IP addresses
Hostnames
MAC addresses
Open ports
Services
Service versions

Automatically create or update asset records.

Module 8 — Service Security Assessment

Implement selected service assessments.

Examples:

HTTPS/TLS
TLS versions
Cipher suites
Certificate information
SMB
SMB protocol versions
SMBv1 status
Other appropriate security information
Module 9 — Windows Assessment

Implement controlled PowerShell assessment.

Collect approved information such as:

OS
Hardware
Installed software
Windows updates
Firewall
Defender
BitLocker
Module 10 — WinRM

Implement authorized remote Windows assessment.

Architecture:

Module 11 — Windows Credential Manager

Implement secure credential storage and retrieval.

The application must not store actual passwords in MySQL.

Module 12 — CVE Database

Implement:

CVE data import
CVE storage
CVE update process
Online update when available
Manual import when offline

Start with a controlled test dataset before implementing a large dataset.

Module 13 — Vulnerability Correlation Engine

Implement:

Module 14 — Findings Management

Implement:

Finding creation
Severity
Status
Recommendations
Notes
Detection dates
Resolution tracking
Module 15 — Dashboard

Create the main dashboard showing:

Total assets
Online assets
Offline assets
Critical findings
High findings
Medium findings
Low findings
Recent scans
Recent findings
Module 16 — Audit Trail

Implement logging of important system activities.

Module 17 — Reporting

Implement:

Asset reports
Vulnerability reports
Security assessment reports
Scan reports
Remediation reports
Audit activity reports
Module 18 — Testing

Perform:

Unit testing
Integration testing
Database testing
Network testing
Security testing
Permission testing
Error handling testing
Performance testing
Usability testing
Module 19 — Final Integration

Only integrate all modules after each individual module has been tested and reviewed.

17. Recommended Folder Structure

The project should use a modular and readable structure.

The structure should remain understandable and should avoid unnecessarily deep folder nesting.

18. Code Quality Requirements

The project must follow maintainable coding practices.

TypeScript

Use:

Strong typing
Interfaces/types
Avoid unnecessary any
Meaningful variable names
Small focused functions
General Code

Use:

Single responsibility
Modular services
Input validation
Centralized error handling
Consistent logging
Clear naming
Reusable components
Minimal duplication

Avoid:

Giant files
Giant functions
Unnecessary abstractions
Duplicate code
Unnecessary dependencies
Hard-coded credentials
Hard-coded environment-specific values
19. Security Requirements

The system must:

Require authentication
Enforce authorization
Use secure password hashing
Protect application sessions
Use secure Electron IPC
Validate IPC input
Prevent arbitrary command execution
Protect Windows credentials
Avoid plaintext passwords
Maintain audit logs
Restrict scanning to authorized networks
Use least-privilege principles
Validate external data
Handle errors without exposing sensitive information

The application must not implement:

Password spraying
Brute-force attacks
Credential attacks
Exploitation
Persistence
Lateral movement
Unauthorized access
Destructive testing
20. Development Rules for Cursor

Cursor must follow these rules.

Rule 1 — Do Not Build Everything at Once

Only work on the current module.

Do not implement future modules without explicit approval.

Rule 2 — Explain Before Coding

Before implementing a module, explain:

Purpose
Architecture
Files involved
Dependencies
Security considerations
Implementation steps
Testing procedure

Wait for approval before writing code.

Rule 3 — Small Changes

Modify only files required for the current module.

Do not refactor unrelated parts unless necessary.

Rule 4 — Explain Dependencies

Before installing a new package:

Explain why it is required.
Explain what it does.
Explain whether an existing dependency can accomplish the same task.
Rule 5 — Test Every Module

A module must be tested before proceeding to the next module.

Rule 6 — Security First

Do not bypass security controls simply to make development easier.

Rule 7 — Preserve Architecture

Maintain separation between:

Rule 8 — Keep Code Readable

The project must be understandable by a BSIT student who needs to explain the implementation during a capstone defense.

Rule 9 — Do Not Overengineer

Prefer simple, understandable solutions over unnecessary enterprise-level complexity.

Rule 10 — Do Not Assume

If a requirement is unclear or a design decision has significant consequences, explain the alternatives before implementing.

21. Development Cycle

Every module must follow:

22. Git Strategy

Use Git throughout development.

Create commits after completing each module.

Example:

Each commit should represent a meaningful and working development stage.

23. Initial Cursor Instruction

After reading this document:

Do not write application code yet.

We are starting with:

Module 1 — Project Foundation

First provide:

Module purpose
Module architecture
Recommended project structure
Required dependencies
Files to be created
Development steps
Testing procedure
Security considerations
Expected result

Do not implement Modules 2–19.

Do not create:

Nmap functionality
PowerShell functionality
WinRM functionality
MySQL functionality
CVE functionality
Vulnerability management
Credential management
Reporting

until their respective modules are reached.

After presenting the Module 1 plan, wait for explicit approval before generating code.
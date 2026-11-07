# Avenea — A Beautiful Path to Better Health

**Early Disease-Risk Screening and Healthcare Coordination for Rural and Underserved Communities**

*A beautiful path to better health.*

---

## 1. Project Overview

**Avenea** is a full-stack healthcare technology prototype designed to improve access to preventive disease-risk screening and coordinated healthcare services for rural and underserved communities.

The platform aims to assist community healthcare workers, clinics, and public-health organizations in identifying potential health risks, maintaining patient screening records, managing referrals, and monitoring healthcare outreach.

Avenea combines a modern React-based user interface with a Python-powered FastAPI backend and MongoDB database to provide a centralized platform for preventive healthcare workflows.

The project emphasizes **early intervention, accessibility, continuity of care, and responsible clinical decision support**.

> **Important:** Avenea is currently an academic demonstration prototype. Its risk-scoring system uses experimental, rule-based heuristics and has not been clinically validated. It must not be used for medical diagnosis, treatment decisions, or real patient care.

---

## 2. Problem Statement

Rural and underserved populations frequently encounter barriers to preventive healthcare, including:

- Limited availability of qualified healthcare professionals.
- Inadequate access to routine preventive screening.
- Delayed identification of potential disease risks.
- Fragmented patient records and follow-up information.
- Inefficient referrals between local clinics and higher-level healthcare facilities.
- Limited infrastructure and digital healthcare accessibility.
- Difficulties monitoring outreach effectiveness across communities.

These challenges may contribute to delayed treatment, missed follow-up appointments, and avoidable complications.

**Avenea seeks to address these challenges through an accessible digital screening and care-coordination platform that supports healthcare professionals rather than replacing them.**

---

## 3. Project Objectives

The primary objectives of Avenea are to:

1. Improve accessibility to preventive disease-risk screening.
2. Support structured collection of patient health information.
3. Identify potential health risks using transparent screening rules.
4. Help healthcare workers prioritize patients who may require additional evaluation.
5. Digitize patient registration and screening records.
6. Support referral management and follow-up coordination.
7. Visualize population-level screening and outreach information.
8. Develop a scalable foundation for future clinically validated screening algorithms.

---

## 4. Key Features

### 4.1 Patient Registration and Management

Avenea provides a patient registry designed to organize essential patient information.

Features include:

- Registering new patients.
- Maintaining basic demographic information.
- Viewing patient records.
- Searching and filtering the patient registry.
- Updating patient information.
- Associating screening records with patients.

Patient information is handled by the Python backend and stored using MongoDB.

### 4.2 Guided Disease-Risk Screening

The platform provides a structured screening workflow for recording patient health information.

Screening inputs include:

- Age and biological sex.
- Blood pressure.
- Blood glucose.
- Pulse rate.
- Lifestyle-related risk factors.
- Relevant symptoms and health indicators.

The backend processes this information using a rule-based scoring mechanism.

### 4.3 Python-Based Risk Assessment

Avenea includes a Python risk-scoring function implemented within the backend.

The current experimental model considers selected physiological measurements, lifestyle factors, patient age, and reported symptoms.

Screenings are categorized into three demonstration risk tiers:

| Risk Tier | Interpretation |
|---|---|
| Low | Lower score under the demonstration rules |
| Moderate | Intermediate score requiring professional review |
| High | Higher score requiring prioritized professional evaluation |

These categories are intended to demonstrate risk-based workflow prioritization.

**The scoring thresholds are illustrative and must not be interpreted as clinically validated disease probabilities or diagnoses.**

### 4.4 Care Coordination and Referral Tracking

Avenea supports a referral workflow for tracking patients who may require further medical evaluation.

Implemented workflow concepts include:

- Creating referral records associated with screenings.
- Tracking pending referrals.
- Updating referral status.
- Assigning referral coordinators.
- Maintaining follow-up notes.
- Recording referral due dates.
- Monitoring completed referrals.

The objective is to demonstrate how digital coordination can reduce fragmented follow-up processes.

### 4.5 Community Outreach Support

The Outreach section presents community healthcare campaign information and screening activity.

It is designed around the needs of public-health teams working across multiple communities.

The current project includes demonstration outreach content, with scope for future integration of real field-visit scheduling, community enrollment, and outreach monitoring.

### 4.6 Analytics and Reporting

Avenea includes an analytics interface for summarizing screening and referral activity.

It presents operational information such as:

- Total patient records.
- Completed screenings.
- Screening risk-tier distribution.
- Referral status information.
- Healthcare workflow metrics.

The dashboard uses frontend data-visualization components connected to backend analytics endpoints.

Some promotional homepage figures and outreach examples are static or synthetic demonstration content.

### 4.7 Printable Screening Summary

The platform provides a printable summary interface for reviewing patient screening information and associated results.

This supports the concept of structured information sharing between healthcare workers and medical professionals.

### 4.8 Authentication and Access Control

The codebase includes authentication-related components and backend security modules.

These provide a foundation for protected healthcare workflows and role-based access control.

Authentication configuration, authorization enforcement, and organization-level data separation require environment-specific setup and further end-to-end verification before real-world deployment.

---

## 5. Technology Stack

Avenea uses a modern frontend-backend architecture.

| Layer | Technology |
|---|---|
| Frontend | React 19 |
| Programming Language — Frontend | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui |
| Navigation | React Router |
| Animations | Motion |
| API Data Management | TanStack Query |
| Data Visualization | Recharts |
| Backend | Python, FastAPI |
| Data Validation | Pydantic |
| Database | MongoDB |
| Database Integration | Motor / PyMongo |
| Backend Testing | pytest |
| Frontend Testing | Playwright |
| Version Control | Git and GitHub |

### Why Python?

Python serves as the backend programming language for Avenea.

It is responsible for:

- Processing screening information.
- Performing rule-based risk calculations.
- Validating incoming data.
- Implementing API endpoints.
- Interacting with MongoDB.
- Supporting future extensions involving statistical analysis and machine learning.

The existing risk engine is deterministic and rule-based; it is not currently a trained artificial intelligence model.

---

## 6. System Architecture

Avenea follows a client-server architecture with separation between the user interface, application logic, and database.

```text
                    AVENEA
        Healthcare Screening Platform
                       |
                       v
              React + TypeScript
                 Frontend
                       |
                       v
             API Communication
                /api/* routes
                       |
                       v
              Python FastAPI
                  Backend
                       |
          +------------+------------+
          |                         |
          v                         v
   Patient & Screening        Risk Assessment
       Management                Logic
          |                         |
          +------------+------------+
                       |
                       v
                    MongoDB
                       |
                       v
              Stored Patient,
           Screening & Referral
                  Records
```

### Architecture Components

**Frontend:** Provides interactive pages for patient registration, health screening, clinical results, referrals, outreach, and analytics.

**Backend:** Processes HTTP requests, applies input validation, executes screening rules, and manages healthcare workflow data.

**Database:** Stores patient records, screening details, and referral information.

**API Layer:** Connects frontend functionality to Python backend endpoints through a centralized request interface.

---

## 7. Project Directory Structure

```text
Avenea-Healthcare-Platform/
│
├── backend/
│   ├── lib/
│   │   ├── db.py
│   │   └── dates.py
│   │
│   ├── models/
│   │   ├── patients.py
│   │   └── screenings.py
│   │
│   ├── routers/
│   │   ├── patients.py
│   │   ├── screenings.py
│   │   └── analytics.py
│   │
│   ├── security/
│   │
│   ├── tests/
│   │
│   ├── server.py
│   ├── seed.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   ├── package.json
│   └── playwright.config.ts
│
├── .gitignore
└── README.md
```

---

## 8. Installation and Local Setup

### Prerequisites

The following software is required for local development:

- Python 3.13
- Node.js and npm
- MongoDB
- Git
- Visual Studio Code or another suitable editor

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Avenea-Healthcare-Platform.git
cd Avenea-Healthcare-Platform
```

Replace `YOUR_USERNAME` with the actual GitHub username after publishing.

### Step 2 — Configure the Python Backend

From the project root, navigate to the backend:

```powershell
cd backend
```

Create a virtual environment:

```powershell
py -3.13 -m venv .venv
```

Install backend dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**Local dependency note:** The original requirements include `emergentintegrations==0.2.2`, which may not be available through standard public pip indexes.

If that specific package cannot be resolved, and it is not imported by the application code, a local development requirements file can be generated:

```powershell
Get-Content .\requirements.txt | Where-Object { $_ -notmatch '^\s*emergentintegrations\b' } | Set-Content .\requirements.local.txt
```

Then install using:

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\requirements.local.txt
```

This workaround is intended only for local development. It does not establish compatibility with every hosted integration or authentication feature.

### Step 3 — Configure Environment Variables

Create a `backend/.env` file containing the local database configuration:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=avenea_local
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Additional authentication settings may be needed for the protected application workflows. Refer to the backend security configuration and documentation.

Never commit `.env` files, authentication credentials, API keys, or actual patient information.

### Step 4 — Start the Backend

Ensure MongoDB is running.

From the `backend` directory, start FastAPI:

```powershell
.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

The backend should be accessible locally at:

`http://localhost:8001`

FastAPI's interactive API documentation is ordinarily available at:

`http://localhost:8001/docs`

### Step 5 — Install and Run the Frontend

Open a second terminal.

From the project root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the local URL displayed by Vite in the terminal.

The frontend uses `/api` requests and its development proxy to communicate with the FastAPI backend.

### Step 6 — Build the Frontend

Run:

```powershell
npm.cmd run build
```

This executes the TypeScript production build and generates compiled frontend files in `frontend/dist`.

**Verified during development:** The Avenea frontend successfully completed a Vite production build. Full local backend/database integration and automated end-to-end execution remain to be verified.

---

## 9. Backend API Overview

The application exposes backend routes through the `/api` prefix.

Representative functionality includes:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/patients` | GET | Retrieve patient records |
| `/api/patients` | POST | Register a patient |
| `/api/patients/{id}` | GET | Retrieve patient details |
| `/api/patients/{id}` | PUT | Update patient information |
| `/api/screenings` | GET | Retrieve screening records |
| `/api/screenings` | POST | Create a screening |
| `/api/screenings/{id}/referral` | PATCH | Update referral information |
| `/api/analytics/summary` | GET | Retrieve analytics summary |

Access to these endpoints may depend on authentication and authorization configuration.

The backend uses Pydantic for data validation and MongoDB for persistence.

---

## 10. Testing and Verification

Avenea includes infrastructure for frontend and backend testing.

### Frontend Verification

The frontend uses TypeScript and Vite.

The following command has successfully completed during local setup:

```powershell
cd frontend
npm.cmd run build
```

### Python Backend Verification

Python dependencies were installed into a dedicated virtual environment.

Basic import verification succeeded for key libraries including:

- FastAPI
- Pydantic
- Motor
- pytest

### Automated Tests

The repository contains backend pytest test modules and a Playwright testing configuration.

These provide a foundation for testing risk calculations, API behavior, input validation, and security-related functionality.

However, the complete automated test suite has not yet been independently verified in the local development environment.

Some backend integration tests interact with running services and databases. Such tests should be executed only against an isolated test environment, never against real patient data or an unprotected shared database.

---

## 11. Data Privacy and Responsible Healthcare Use

Healthcare applications require careful attention to patient privacy, security, clinical validity, and ethical technology development.

Avenea is designed around the following principles:

**Patient privacy:** Protecting sensitive health information through appropriate authentication, authorization, and secure data handling.

**Transparency:** Making the limitations of automated screening clearly visible.

**Human oversight:** Ensuring qualified healthcare professionals remain responsible for clinical decisions.

**Data minimization:** Collecting and storing only information appropriate to a defined healthcare workflow.

**Responsible demonstration:** Using synthetic records during academic development.

The current project uses synthetic demonstration data.

Avenea has not undergone formal clinical validation, regulatory review, or a comprehensive production security assessment.

It should not be deployed with real patient information until these requirements are appropriately addressed.

---

## 12. Current Project Status

Avenea is an academic full-stack prototype under active development.

| Component | Status |
|---|---|
| React user interface | Implemented |
| Responsive visual design | Implemented; further device testing planned |
| Python backend structure | Implemented |
| Patient registry APIs | Implemented in code |
| Screening risk-scoring logic | Implemented as a demonstration heuristic |
| Referral workflow | Implemented in code |
| Analytics dashboard | Implemented in code |
| Database integration | Implemented; local runtime verification pending |
| Frontend production build | Successfully verified |
| Authentication and authorization | Further integration verification required |
| Automated end-to-end testing | Pending |
| Clinical validation | Not completed |

---

## Known Limitations and Development Status

Avenea is currently an academic full-stack prototype developed to demonstrate early disease-risk screening and healthcare coordination.

### Verified Functionality

- The React and TypeScript frontend successfully completed its Vite production build.
- Python backend dependencies were installed and basic import verification completed successfully.
- The application includes frontend components, backend API implementations, screening workflows, patient management, referral coordination, and analytics functionality.

### Known Development Limitations

**1. Automated Testing Configuration**

The local Playwright testing configuration currently contains unresolved TypeScript diagnostics. Consequently, successful execution of the complete end-to-end testing suite has not yet been verified.

These configuration issues are separate from the successfully completed frontend production build.

**2. Development Environment Differences**

The project was originally generated using the Emergent development environment and subsequently transferred to a local Windows development environment.

Some environment-specific dependencies and configurations required adjustments during migration. Further compatibility testing may be necessary.

**3. Backend and Database Integration**

Although Python dependencies and basic module imports have been verified, complete local execution of the FastAPI backend, MongoDB integration, and authentication-dependent workflows has not yet been confirmed.

**4. Clinical Validation**

The current disease-risk assessment mechanism is an experimental, rule-based heuristic.

It has not undergone formal clinical validation and should not be used for medical diagnosis or real-world treatment decisions.

**5. Demonstration Data**

The project uses synthetic patient records and illustrative healthcare metrics. These do not represent actual clinical outcomes.

### Planned Improvements

Future development will focus on resolving automated testing configuration issues, verifying complete frontend-backend integration, improving deployment compatibility, strengthening authentication and data protection, and evaluating clinically validated screening methods.

**Project Status:** Functional frontend prototype with implemented backend modules; full-stack runtime verification and further testing pending.

## 13. Future Enhancements

Avenea is designed as a foundation for further development.

Potential improvements include:

### Clinically Validated Screening Models

Evaluate and integrate suitable clinical risk assessment methods, subject to appropriate validation, eligibility requirements, and medical oversight.

### Machine Learning Integration

Explore properly trained and externally validated predictive models using representative healthcare datasets.

### Multilingual Accessibility

Develop multilingual interfaces and patient-facing communication in:

- English
- Kannada
- Telugu

### Offline-First Screening

Introduce reliable offline data entry, encrypted local storage, and synchronization for healthcare workers in areas with limited connectivity.

### Mobile-Friendly Field Operations

Optimize the platform for mobile devices used by community healthcare workers during household visits and screening campaigns.

### Advanced Referral Monitoring

Expand support for referral escalation, follow-up reminders, care-team coordination, and longitudinal patient records.

### Security and Compliance

Strengthen authentication, organization-level isolation, encryption, auditability, access control, and applicable healthcare privacy compliance.

### Performance Optimization

Improve frontend loading performance, API efficiency, database scalability, and accessibility for low-bandwidth environments.

---

## 14. Potential Applications

Avenea is intended to explore healthcare technology solutions for:

- Rural primary healthcare centers.
- Community healthcare workers.
- Public-health departments.
- Non-governmental healthcare organizations.
- Preventive screening programs.
- Healthcare outreach teams.
- Diagnostic and referral networks.

Future institutional adoption would depend on clinical validation, security, infrastructure compatibility, affordability, and applicable regulatory requirements.

---

## 15. Conclusion

Avenea represents an effort to make preventive healthcare more accessible, organized, and human-centered.

By combining structured screening, Python-based risk assessment, patient record management, referral tracking, and healthcare analytics, the platform demonstrates how digital tools can support more coordinated preventive healthcare workflows.

The long-term vision is to develop a trustworthy, accessible, and clinically responsible healthcare platform that helps underserved communities connect with timely and appropriate medical services.

**Avenea — A Beautiful Path to Better Health.**

*Because a healthier tomorrow begins with the opportunity to receive care today.*

---

**Project Category:** Healthcare Technology / Preventive Disease-Risk Screening

**Project Type:** Academic Full-Stack Software Prototype

**Primary Technologies:** Python, FastAPI, React, TypeScript, MongoDB

**Development Status:** Prototype — Under Development

**Data Classification:** Synthetic Demonstration Data Only
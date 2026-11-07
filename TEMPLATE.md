# Avenea — Developer Guide

**Project:** Avenea — Early Disease-Risk Screening and Healthcare Coordination

**Tagline:** A Beautiful Path to Better Health

**Project Type:** Academic Full-Stack Healthcare Technology Prototype

**Status:** Under Development

---

## 1. Introduction

Avenea is a full-stack healthcare application prototype developed to explore preventive disease-risk screening and continuity of care for rural and underserved communities.

The platform connects patient registration, guided health screening, demonstration risk assessment, referral management, community outreach, and operational analytics within a unified application.

This document describes the technical architecture, source-code organization, development environment, implementation conventions, and current development limitations.

## 2. Technology Architecture

Avenea uses a three-layer application architecture.

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | Interactive user interface |
| UI Styling | Tailwind CSS 4, shadcn/ui | Responsive interface components |
| Animations | Motion | Transitions and interface animations |
| State and Data | TanStack Query | API data management |
| Charts | Recharts | Analytics visualization |
| Backend | Python, FastAPI | APIs and application logic |
| Validation | Pydantic v2 | Structured data validation |
| Database | MongoDB | Persistent application records |
| Database Driver | Motor / PyMongo | Database communication |
| Testing | pytest, Playwright | Backend and browser testing |

### Architecture Flow

```text
Avenea Frontend
React + TypeScript
        |
        | HTTP requests
        v
API Layer (/api)
        |
        v
Python FastAPI Backend
        |
        +---- Patient Management
        |
        +---- Screening Management
        |
        +---- Rule-Based Risk Calculation
        |
        +---- Referral Coordination
        |
        +---- Analytics
        |
        +---- Authentication / Authorization
        |
        v
MongoDB Database
```

The frontend and backend are separate applications communicating through HTTP APIs.

## 3. Project Directory

```text
Avenea-Healthcare-Platform/
|
|-- backend/
|   |-- lib/
|   |   |-- db.py
|   |   |-- dates.py
|   |
|   |-- models/
|   |   |-- patients.py
|   |   |-- screenings.py
|   |
|   |-- routers/
|   |   |-- analytics.py
|   |   |-- patients.py
|   |   |-- screenings.py
|   |
|   |-- security/
|   |-- migrations/
|   |-- tests/
|   |-- server.py
|   |-- seed.py
|   |-- requirements.txt
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- lib/
|   |   |-- pages/
|   |   |-- App.tsx
|   |   |-- main.tsx
|   |   |-- index.css
|   |
|   |-- package.json
|   |-- vite.config.ts
|
|-- tests/
|   |-- e2e/
|   |-- fixtures/
|   |-- playwright.config.ts
|
|-- .gitignore
|-- README.md
|-- DEVELOPMENT.md
```

## 4. Backend Architecture

The backend is developed using Python and FastAPI.

### Application Entry Point

`backend/server.py` initializes the FastAPI application and registers the API routes.

Backend resources are organized into separate modules.

### Patient Models

`backend/models/patients.py` defines structured patient information and validation models.

### Screening Models

`backend/models/screenings.py` defines screening information and the existing demonstration risk-assessment logic.

### API Routers

The `backend/routers/` directory contains the patient, screening, and analytics endpoints.

### Database Integration

`backend/lib/db.py` manages the shared MongoDB connection and database index definitions.

Database settings are provided through environment variables.

## 5. Risk Assessment Engine

Avenea currently uses an experimental, deterministic, rule-based risk assessment mechanism.

The existing implementation considers selected health indicators, such as:

- Blood pressure
- Blood glucose
- Pulse rate
- Age
- Smoking and lifestyle factors
- Reported symptoms

The calculated score is mapped to demonstration risk tiers: low, moderate, and high.

### Clinical Limitations

The existing risk engine is not a trained machine learning model and has not undergone clinical validation.

Risk scores must not be represented as confirmed diagnoses or scientifically established disease probabilities.

Future versions may evaluate clinically validated assessment methods under appropriate medical supervision.

## 6. Frontend Architecture

The frontend is developed using React and TypeScript.

### Application Routing

`frontend/src/App.tsx` manages application routes.

Individual pages are organized in `frontend/src/pages/`.

### Reusable Components

Shared interface elements are located inside `frontend/src/components/`.

These include navigation elements, the homepage artwork, page headers, animation elements, and reusable UI controls.

### API Communication

`frontend/src/lib/api.ts` manages communication with the backend using relative `/api` endpoints.

TypeScript interfaces define the expected response structures.

### State Management

TanStack Query supports asynchronous API data management and caching.

### Visual Design

Avenea follows a distinctive pink healthcare-inspired editorial design system.

Its visual identity uses:

- Soft blush and rose tones
- Elegant serif typography
- Flowing pathway-inspired artwork
- Smooth interface transitions
- Rounded navigation and cards
- Warm, accessible visual composition

Visual styling is maintained separately from Python backend functionality.

## 7. Development Environment

The project can be developed locally on Windows using Visual Studio Code.

### Prerequisites

- Python 3.13
- Node.js and npm
- MongoDB
- Git
- Visual Studio Code

### Backend Setup

Navigate into the backend directory:

```powershell
cd backend
```

Create a Python virtual environment:

```powershell
py -3.13 -m venv .venv
```

Install dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Note: The original Emergent dependency list contains a platform-specific integration package that may not be available from the public Python package index. Refer to the main README for the local development workaround.

Configure the required database and authentication environment variables before starting the server.

### Start the Backend

```powershell
.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

### Frontend Setup

In a separate terminal, navigate to the frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the local development address shown by Vite.

The backend and database must be available for data-dependent workflows to operate.

## 8. Frontend Build

Avenea uses TypeScript checking and Vite for its production build.

Run:

```powershell
cd frontend
npm.cmd run build
```

### Verified Build Status

The frontend production build was successfully completed during local setup.

This confirms that the frontend compiled successfully, but it does not independently establish that all backend APIs, authentication workflows, or database operations work correctly.

## 9. Testing

### Backend Testing

Backend tests are organized inside:

`backend/tests/`

The project contains tests for areas including:

- Screening risk calculations
- Data validation
- API behavior
- Access control
- Security components

### Frontend Testing

The `tests/` directory contains a Playwright testing workspace.

Playwright supports automated browser interaction and end-to-end testing.

The local Playwright configuration still requires further verification.

### Testing Precautions

Integration tests must use an isolated test database and synthetic information.

Tests that create, update, migrate, or delete records should not run against production or shared patient databases.

## 10. Authentication and Security

Avenea contains backend security modules and frontend authentication-related components.

The architecture includes provisions for:

- Identity verification
- Access control
- Role definitions
- Organization-scoped information
- Security audit events

Security behavior must be verified in the intended deployment environment before the system is used outside an academic demonstration.

Sensitive authentication credentials and database connection strings must remain outside version control.

## 11. Data Management

The application uses MongoDB for storing patient and screening information.

Referrals are associated with screening records.

The existing project contains synthetic demonstration records.

### Privacy Requirements

Development and testing must avoid real patient information.

Database backups, `.env` files, private credentials, generated test artifacts, and local dependency environments should not be included in public repositories.

The application has not been certified for handling real-world clinical information.

## 12. Current Development Status

| Component | Status |
|---|---|
| React frontend | Implemented |
| Python FastAPI backend | Implemented |
| Patient registration modules | Implemented in code |
| Screening models and calculations | Implemented in code |
| Referral management modules | Implemented in code |
| Analytics interface | Implemented |
| MongoDB integration | Implemented in code |
| Frontend production build | Verified successfully |
| Backend dependency imports | Verified successfully |
| Full local end-to-end functionality | Pending verification |
| Authentication workflow verification | Pending |
| Automated testing | Requires further validation |
| Clinical validation | Not completed |

## 13. Future Development

Planned areas of exploration include:

**Clinical validation:** Evaluating appropriate published screening methods and their performance on representative populations.

**Machine learning:** Investigating responsible predictive modeling after suitable dataset preparation, validation, and expert review.

**Multilingual accessibility:** Supporting English, Kannada, and Telugu for rural healthcare accessibility.

**Offline support:** Exploring encrypted offline data entry and synchronization for regions with limited connectivity.

**Performance optimization:** Improving application loading time, database query performance, and low-bandwidth usability.

**Referral enhancement:** Supporting more complete follow-up tracking, reminders, and care-team workflows.

**Security:** Expanding integration tests and evaluating privacy, authorization, and organization-level data isolation.

## 14. Development Principles

Avenea's development follows these priorities:

1. Maintain clear separation between frontend presentation and backend functionality.
2. Use structured validation for incoming health information.
3. Preserve data integrity when changing database models.
4. Avoid introducing unverified clinical claims.
5. Protect patient information and credentials.
6. Maintain accessible, consistent interface behavior.
7. Document technical changes and outstanding limitations.
8. Keep healthcare professionals responsible for medical decisions.

---

## Conclusion

Avenea demonstrates the potential of combining Python-based application logic, modern frontend technologies, and coordinated healthcare workflows to support preventive screening in underserved communities.

The current prototype provides a foundation for further research, testing, clinical evaluation, and responsible healthcare technology development.

**Avenea — A Beautiful Path to Better Health.**

*Academic prototype. Synthetic demonstration data. Not intended for clinical use.*
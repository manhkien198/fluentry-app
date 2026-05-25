# SonarQube setup

This repository includes a root `sonar-project.properties` configured for both backend and mobile source trees.

## Prerequisites
- Running SonarQube server
- Sonar scanner CLI available as `sonar-scanner`
- `SONAR_TOKEN` env var set

## Generate coverage before scan

### Backend
```bash
cd backend
.mfa-venv/bin/python -m pip install pytest pytest-cov
.mfa-venv/bin/python -m pytest --cov=app --cov-report=xml
```

### Mobile
```bash
cd mobile
npm test -- --coverage --runInBand
```

## Run scanner
From repository root:
```bash
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=$SONAR_TOKEN
```

## CI recommendation
1. Run backend tests with coverage (`coverage.xml`)
2. Run mobile tests with coverage (`coverage/lcov.info`)
3. Run `sonar-scanner`
4. Configure quality gate to fail pipeline on:
   - new critical/blocker issues
   - coverage drop on new code
   - security hotspot review required

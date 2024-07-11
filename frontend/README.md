# Signal Detection Platform - Frontend Proof of Concept

This proof of concept is a showcase of tools to aid humans detect potential health
threats by leveraging the data innovation team's proposed architecture.

## Configuration

The front end is configured via environment variables, the
[.env.example](./.env.example) file contains all the available configuration
options; you can use it to get started.

```bash
cp .env.example .env
```

### Database and services

| Variable       | Description                                    |
| -------------- | ---------------------------------------------- |
| DATABASE_URL   | Database to maintain user sessions             |
| NEO4J_USERNAME | Neo4J username                                 |
| NEO4J_PASSWORD | Neo4j password                                 |
| NEO4J_URL      | Neo4j instance with article data               |
| DFO_NEO4J_URL  | Neo4j instance with DFO data                   |
| QA_SERVICE_URL | URL of service proving AI answers to questions |

### Authentication and Access Control

> All list values are comma separated.

| Variable             | Description                                          |
| -------------------- | ---------------------------------------------------- |
| NEXTAUTH_SECRET      | Used to encrypt the JWT and to hash tokens           |
| NEXTAUTH_URL         | Base URL used for redirects                          |
| GITHUB_CLIENT_ID     | Client ID for Github OAuth authentication            |
| GITHUB_CLIENT_SECRET | Secret for Github OAuth authentication               |
| GITHUB_ALLOWED_USERS | List of github usernames allowed to sign in          |
| RESTRICTED_USERS     | List of github users without access to article data. |

### Third party

> This prototype uses [Ogma](https://doc.linkurious.com/ogma/latest/) by
> Linkurious, and [Google maps](https://developers.google.com/maps/documentation/javascript/get-api-key).
> Both of these require a key to be used.

| Variable                   | Description             |
| -------------------------- | ----------------------- |
| OGMA_KEY                   | Key to download Ogma    |
| NEXT_PUBLIC_GOOGLE_API_KEY | Key to use google maps. |

## Testing and linting

To run the test suites, run the following command:

```bash
npm run test
```

To perform linting, run the following command:

```bash
npm run lint
```

## Contributing

All commits must pass all unit tests and linting.  This project uses rather
strict linting rules, to enforce code consistency.  It is recommended to use
VSCode and install the recommended extensions to help.

## Launching
To start the local development server, use the following command:

```bash
npm run dev
```

By default, the application will launch on port 3000.  Use your browser to
visit [http://localhost:3000](http://localhost:3000).

## Deployment

The frontend is deployed as a docker image, suitable for containerization. All
environment variables should be passed to the docker build as build arguments. 

```bash
cd frontend
 docker build . \
    --build-arg DATABASE_URL=<replace_with_database_url> \
    --build-arg OGMA_KEY=<replace_with_key> \
    --build-arg NEO4J_USERNAME=<replace_with_username> \
    --build-arg NEO4J_PASSWORD=<replace_with_password> \
    --build-arg NEO4J_URL=<replace_with_url> \
    --build-arg QA_SERVICE_URL=<replace_with_url> \
    --build-arg NEXT_PUBLIC_GOOGLE_API_KEY=<replace_with_api_key> \
    --build-arg DFO_NEO4J_URL=<replace_with_url> \
    --build-arg GITHUB_CLIENT_ID=<replace_with_client_id> \
    --build-arg GITHUB_CLIENT_SECRET=<replace_with_secret> \
    --build-arg GITHUB_ALLOWED_USERS=<replace_with_allowed_users> \
    --build-arg RESTRICTED_USERS=<replace_with_restricted_users> \
    --build-arg NEXTAUTH_SECRET=<replace_with_secret> \
    --build-arg NEXTAUTH_URL=<replace_with_url> \
    -t foresight-frontend
```
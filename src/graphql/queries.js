/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getTask = /* GraphQL */ `
  query GetTask($id: ID!) {
    getTask(id: $id) {
      id
      title
      description
      status
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listTasks = /* GraphQL */ `
  query ListTasks(
    $filter: ModelTaskFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTasks(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        title
        description
        status
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getPrivateNote = /* GraphQL */ `
  query GetPrivateNote($id: ID!) {
    getPrivateNote(id: $id) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const listPrivateNotes = /* GraphQL */ `
  query ListPrivateNotes(
    $filter: ModelPrivateNoteFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPrivateNotes(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        content
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getBroker = /* GraphQL */ `
  query GetBroker($id: ID!) {
    getBroker(id: $id) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listBrokers = /* GraphQL */ `
  query ListBrokers(
    $filter: ModelBrokerFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listBrokers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        primaryContact
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getBrokerLogin = /* GraphQL */ `
  query GetBrokerLogin($id: ID!) {
    getBrokerLogin(id: $id) {
      id
      brokerUserName
      brokerPassword
      broker {
        id
        name
        primaryContact
        createdAt
        updatedAt
        __typename
      }
      createdAt
      updatedAt
      brokerLoginBrokerId
      owner
      __typename
    }
  }
`;
export const listBrokerLogins = /* GraphQL */ `
  query ListBrokerLogins(
    $filter: ModelBrokerLoginFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listBrokerLogins(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        brokerUserName
        brokerPassword
        createdAt
        updatedAt
        brokerLoginBrokerId
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getTradeExecution = /* GraphQL */ `
  query GetTradeExecution($id: ID!) {
    getTradeExecution(id: $id) {
      id
      brokerLogin {
        id
        brokerUserName
        brokerPassword
        createdAt
        updatedAt
        brokerLoginBrokerId
        owner
        __typename
      }
      ModelVersion {
        id
        current
        versionNumber
        createdAt
        updatedAt
        modelVersionModelId
        __typename
      }
      positionSize
      activeEntry
      activeExit
      createdAt
      updatedAt
      tradeExecutionBrokerLoginId
      tradeExecutionModelVersionId
      owner
      __typename
    }
  }
`;
export const listTradeExecutions = /* GraphQL */ `
  query ListTradeExecutions(
    $filter: ModelTradeExecutionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTradeExecutions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        positionSize
        activeEntry
        activeExit
        createdAt
        updatedAt
        tradeExecutionBrokerLoginId
        tradeExecutionModelVersionId
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getModel = /* GraphQL */ `
  query GetModel($id: ID!) {
    getModel(id: $id) {
      id
      name
      provider {
        id
        name
        primaryContact
        createdAt
        updatedAt
        __typename
      }
      price
      description
      createdAt
      updatedAt
      modelProviderId
      __typename
    }
  }
`;
export const listModels = /* GraphQL */ `
  query ListModels(
    $filter: ModelModelFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listModels(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        price
        description
        createdAt
        updatedAt
        modelProviderId
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getModelVersion = /* GraphQL */ `
  query GetModelVersion($id: ID!) {
    getModelVersion(id: $id) {
      id
      current
      model {
        id
        name
        price
        description
        createdAt
        updatedAt
        modelProviderId
        __typename
      }
      versionNumber
      createdAt
      updatedAt
      modelVersionModelId
      __typename
    }
  }
`;
export const listModelVersions = /* GraphQL */ `
  query ListModelVersions(
    $filter: ModelModelVersionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listModelVersions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        current
        versionNumber
        createdAt
        updatedAt
        modelVersionModelId
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getProvider = /* GraphQL */ `
  query GetProvider($id: ID!) {
    getProvider(id: $id) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listProviders = /* GraphQL */ `
  query ListProviders(
    $filter: ModelProviderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listProviders(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        primaryContact
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;

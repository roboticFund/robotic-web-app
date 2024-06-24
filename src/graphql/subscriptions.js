/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateTask = /* GraphQL */ `
  subscription OnCreateTask($filter: ModelSubscriptionTaskFilterInput) {
    onCreateTask(filter: $filter) {
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
export const onUpdateTask = /* GraphQL */ `
  subscription OnUpdateTask($filter: ModelSubscriptionTaskFilterInput) {
    onUpdateTask(filter: $filter) {
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
export const onDeleteTask = /* GraphQL */ `
  subscription OnDeleteTask($filter: ModelSubscriptionTaskFilterInput) {
    onDeleteTask(filter: $filter) {
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
export const onCreatePrivateNote = /* GraphQL */ `
  subscription OnCreatePrivateNote(
    $filter: ModelSubscriptionPrivateNoteFilterInput
    $owner: String
  ) {
    onCreatePrivateNote(filter: $filter, owner: $owner) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onUpdatePrivateNote = /* GraphQL */ `
  subscription OnUpdatePrivateNote(
    $filter: ModelSubscriptionPrivateNoteFilterInput
    $owner: String
  ) {
    onUpdatePrivateNote(filter: $filter, owner: $owner) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onDeletePrivateNote = /* GraphQL */ `
  subscription OnDeletePrivateNote(
    $filter: ModelSubscriptionPrivateNoteFilterInput
    $owner: String
  ) {
    onDeletePrivateNote(filter: $filter, owner: $owner) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onCreateBroker = /* GraphQL */ `
  subscription OnCreateBroker($filter: ModelSubscriptionBrokerFilterInput) {
    onCreateBroker(filter: $filter) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateBroker = /* GraphQL */ `
  subscription OnUpdateBroker($filter: ModelSubscriptionBrokerFilterInput) {
    onUpdateBroker(filter: $filter) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteBroker = /* GraphQL */ `
  subscription OnDeleteBroker($filter: ModelSubscriptionBrokerFilterInput) {
    onDeleteBroker(filter: $filter) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateBrokerLogin = /* GraphQL */ `
  subscription OnCreateBrokerLogin(
    $filter: ModelSubscriptionBrokerLoginFilterInput
    $owner: String
  ) {
    onCreateBrokerLogin(filter: $filter, owner: $owner) {
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
export const onUpdateBrokerLogin = /* GraphQL */ `
  subscription OnUpdateBrokerLogin(
    $filter: ModelSubscriptionBrokerLoginFilterInput
    $owner: String
  ) {
    onUpdateBrokerLogin(filter: $filter, owner: $owner) {
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
export const onDeleteBrokerLogin = /* GraphQL */ `
  subscription OnDeleteBrokerLogin(
    $filter: ModelSubscriptionBrokerLoginFilterInput
    $owner: String
  ) {
    onDeleteBrokerLogin(filter: $filter, owner: $owner) {
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
export const onCreateTradeExecution = /* GraphQL */ `
  subscription OnCreateTradeExecution(
    $filter: ModelSubscriptionTradeExecutionFilterInput
    $owner: String
  ) {
    onCreateTradeExecution(filter: $filter, owner: $owner) {
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
export const onUpdateTradeExecution = /* GraphQL */ `
  subscription OnUpdateTradeExecution(
    $filter: ModelSubscriptionTradeExecutionFilterInput
    $owner: String
  ) {
    onUpdateTradeExecution(filter: $filter, owner: $owner) {
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
export const onDeleteTradeExecution = /* GraphQL */ `
  subscription OnDeleteTradeExecution(
    $filter: ModelSubscriptionTradeExecutionFilterInput
    $owner: String
  ) {
    onDeleteTradeExecution(filter: $filter, owner: $owner) {
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
export const onCreateModel = /* GraphQL */ `
  subscription OnCreateModel($filter: ModelSubscriptionModelFilterInput) {
    onCreateModel(filter: $filter) {
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
export const onUpdateModel = /* GraphQL */ `
  subscription OnUpdateModel($filter: ModelSubscriptionModelFilterInput) {
    onUpdateModel(filter: $filter) {
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
export const onDeleteModel = /* GraphQL */ `
  subscription OnDeleteModel($filter: ModelSubscriptionModelFilterInput) {
    onDeleteModel(filter: $filter) {
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
export const onCreateModelVersion = /* GraphQL */ `
  subscription OnCreateModelVersion(
    $filter: ModelSubscriptionModelVersionFilterInput
  ) {
    onCreateModelVersion(filter: $filter) {
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
export const onUpdateModelVersion = /* GraphQL */ `
  subscription OnUpdateModelVersion(
    $filter: ModelSubscriptionModelVersionFilterInput
  ) {
    onUpdateModelVersion(filter: $filter) {
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
export const onDeleteModelVersion = /* GraphQL */ `
  subscription OnDeleteModelVersion(
    $filter: ModelSubscriptionModelVersionFilterInput
  ) {
    onDeleteModelVersion(filter: $filter) {
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
export const onCreateProvider = /* GraphQL */ `
  subscription OnCreateProvider($filter: ModelSubscriptionProviderFilterInput) {
    onCreateProvider(filter: $filter) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateProvider = /* GraphQL */ `
  subscription OnUpdateProvider($filter: ModelSubscriptionProviderFilterInput) {
    onUpdateProvider(filter: $filter) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteProvider = /* GraphQL */ `
  subscription OnDeleteProvider($filter: ModelSubscriptionProviderFilterInput) {
    onDeleteProvider(filter: $filter) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;

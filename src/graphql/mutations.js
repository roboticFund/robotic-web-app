/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createTask = /* GraphQL */ `
  mutation CreateTask(
    $input: CreateTaskInput!
    $condition: ModelTaskConditionInput
  ) {
    createTask(input: $input, condition: $condition) {
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
export const updateTask = /* GraphQL */ `
  mutation UpdateTask(
    $input: UpdateTaskInput!
    $condition: ModelTaskConditionInput
  ) {
    updateTask(input: $input, condition: $condition) {
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
export const deleteTask = /* GraphQL */ `
  mutation DeleteTask(
    $input: DeleteTaskInput!
    $condition: ModelTaskConditionInput
  ) {
    deleteTask(input: $input, condition: $condition) {
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
export const createPrivateNote = /* GraphQL */ `
  mutation CreatePrivateNote(
    $input: CreatePrivateNoteInput!
    $condition: ModelPrivateNoteConditionInput
  ) {
    createPrivateNote(input: $input, condition: $condition) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const updatePrivateNote = /* GraphQL */ `
  mutation UpdatePrivateNote(
    $input: UpdatePrivateNoteInput!
    $condition: ModelPrivateNoteConditionInput
  ) {
    updatePrivateNote(input: $input, condition: $condition) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const deletePrivateNote = /* GraphQL */ `
  mutation DeletePrivateNote(
    $input: DeletePrivateNoteInput!
    $condition: ModelPrivateNoteConditionInput
  ) {
    deletePrivateNote(input: $input, condition: $condition) {
      id
      content
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const createBroker = /* GraphQL */ `
  mutation CreateBroker(
    $input: CreateBrokerInput!
    $condition: ModelBrokerConditionInput
  ) {
    createBroker(input: $input, condition: $condition) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateBroker = /* GraphQL */ `
  mutation UpdateBroker(
    $input: UpdateBrokerInput!
    $condition: ModelBrokerConditionInput
  ) {
    updateBroker(input: $input, condition: $condition) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteBroker = /* GraphQL */ `
  mutation DeleteBroker(
    $input: DeleteBrokerInput!
    $condition: ModelBrokerConditionInput
  ) {
    deleteBroker(input: $input, condition: $condition) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const createBrokerLogin = /* GraphQL */ `
  mutation CreateBrokerLogin(
    $input: CreateBrokerLoginInput!
    $condition: ModelBrokerLoginConditionInput
  ) {
    createBrokerLogin(input: $input, condition: $condition) {
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
export const updateBrokerLogin = /* GraphQL */ `
  mutation UpdateBrokerLogin(
    $input: UpdateBrokerLoginInput!
    $condition: ModelBrokerLoginConditionInput
  ) {
    updateBrokerLogin(input: $input, condition: $condition) {
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
export const deleteBrokerLogin = /* GraphQL */ `
  mutation DeleteBrokerLogin(
    $input: DeleteBrokerLoginInput!
    $condition: ModelBrokerLoginConditionInput
  ) {
    deleteBrokerLogin(input: $input, condition: $condition) {
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
export const createTradeExecution = /* GraphQL */ `
  mutation CreateTradeExecution(
    $input: CreateTradeExecutionInput!
    $condition: ModelTradeExecutionConditionInput
  ) {
    createTradeExecution(input: $input, condition: $condition) {
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
export const updateTradeExecution = /* GraphQL */ `
  mutation UpdateTradeExecution(
    $input: UpdateTradeExecutionInput!
    $condition: ModelTradeExecutionConditionInput
  ) {
    updateTradeExecution(input: $input, condition: $condition) {
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
export const deleteTradeExecution = /* GraphQL */ `
  mutation DeleteTradeExecution(
    $input: DeleteTradeExecutionInput!
    $condition: ModelTradeExecutionConditionInput
  ) {
    deleteTradeExecution(input: $input, condition: $condition) {
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
export const createModel = /* GraphQL */ `
  mutation CreateModel(
    $input: CreateModelInput!
    $condition: ModelModelConditionInput
  ) {
    createModel(input: $input, condition: $condition) {
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
export const updateModel = /* GraphQL */ `
  mutation UpdateModel(
    $input: UpdateModelInput!
    $condition: ModelModelConditionInput
  ) {
    updateModel(input: $input, condition: $condition) {
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
export const deleteModel = /* GraphQL */ `
  mutation DeleteModel(
    $input: DeleteModelInput!
    $condition: ModelModelConditionInput
  ) {
    deleteModel(input: $input, condition: $condition) {
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
export const createModelVersion = /* GraphQL */ `
  mutation CreateModelVersion(
    $input: CreateModelVersionInput!
    $condition: ModelModelVersionConditionInput
  ) {
    createModelVersion(input: $input, condition: $condition) {
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
export const updateModelVersion = /* GraphQL */ `
  mutation UpdateModelVersion(
    $input: UpdateModelVersionInput!
    $condition: ModelModelVersionConditionInput
  ) {
    updateModelVersion(input: $input, condition: $condition) {
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
export const deleteModelVersion = /* GraphQL */ `
  mutation DeleteModelVersion(
    $input: DeleteModelVersionInput!
    $condition: ModelModelVersionConditionInput
  ) {
    deleteModelVersion(input: $input, condition: $condition) {
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
export const createProvider = /* GraphQL */ `
  mutation CreateProvider(
    $input: CreateProviderInput!
    $condition: ModelProviderConditionInput
  ) {
    createProvider(input: $input, condition: $condition) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateProvider = /* GraphQL */ `
  mutation UpdateProvider(
    $input: UpdateProviderInput!
    $condition: ModelProviderConditionInput
  ) {
    updateProvider(input: $input, condition: $condition) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteProvider = /* GraphQL */ `
  mutation DeleteProvider(
    $input: DeleteProviderInput!
    $condition: ModelProviderConditionInput
  ) {
    deleteProvider(input: $input, condition: $condition) {
      id
      name
      primaryContact
      createdAt
      updatedAt
      __typename
    }
  }
`;

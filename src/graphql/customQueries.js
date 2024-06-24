export const listTradeExecutions = /* GraphQL */ `
query ListTradeExecutions {
  listTradeExecutions {
    items {
      id
      owner
      positionSize
      activeEntry
      activeExit
      brokerLogin {
        broker {
            name
        }
        id
        brokerUserName
        brokerPassword
        # Include other fields you need from BrokerLogin
      }
      ModelVersion {
        id
        versionNumber
        current
        model {
            id
            name
        }
      }
    }
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
        model {
            id
            name
            provider {
                name
            }
        }
        __typename
      }
      nextToken
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
        broker {
            id
            name
        }
        __typename
      }
      nextToken
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
        provider {
          id
          name
        }
        __typename
      }
      nextToken
      __typename
    }
  }
`;
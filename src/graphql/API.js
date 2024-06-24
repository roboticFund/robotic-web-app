//import { API, graphqlOperation } from 'aws-amplify';
import { generateClient } from "aws-amplify/api"
import { listModelVersions, listProviders } from './queries';
import {listModels} from './customQueries';
import { createModel, updateModel, createModelVersion, deleteModelVersion, deleteModel, updateModelVersion } from './mutations';
import { version } from "vue";

export const client = generateClient();

export const fetchModelVersions = async (modelId) => {
    try {
       const response = await client.graphql({query: listModelVersions, 
        variables: {
            filter: {
                modelVersionModelId: { eq: modelId },
              },
            }
        }
          );
     /* const response = await client.graphql(
        listModelVersions, {
          filter: {
            modelVersionModelId: { eq: modelId },
          },
        }
      );*/
    console.log("LISTMODELVERSIONS: ");
    console.log(response.data.listModelVersions)
      return response.data.listModelVersions.items;
    } catch (error) {
      console.error('Error fetching model versions:', error);
      return [];
    }
  };

  export const fetchModels = async () => {
    try {

       const response = await client.graphql({query: listModels,
            }
          );


     /* const response = await client.graphql(
        listModelVersions, {
          filter: {
            modelVersionModelId: { eq: modelId },
          },
        }
      );*/
    console.log("LISTMODELS: ");
    console.log(response.data.listModels)
      return response.data.listModels.items;
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  };

  export const fetchProviders = async () => {
    try {

       const response = await client.graphql({query: listProviders,
            }
          );


     /* const response = await client.graphql(
        listModelVersions, {
          filter: {
            modelVersionModelId: { eq: modelId },
          },
        }
      );*/
    console.log("LISTPROVIDERS: ");
    console.log(response.data.listProviders)
      return response.data.listProviders.items;
    } catch (error) {
      console.error('Error fetching providers:', error);
      return [];
    }
  };
  

  export const addModel = async (input) => {
    //const BrokerName = name.value;
    //if (!brokerUserName.value || !brokerPassword.value || !selectedBroker.value)   {
    //  showErrorMessage('Cannot create record. Please enusre all necessary infromation is provided.');
    //  return;
    //}
    /*const input = { 
      brokerLoginBrokerId: selectedBroker.value,
      brokerUserName: brokerUserName.value,
      brokerPassword: brokerPassword.value,
      //owner: $auth.user?.username
     };*/
    try {
          await client.graphql({
            query: createModel,
            variables: { input: input },
          });
        }
    catch(error) {
          console.log('ERROR')
          console.error(error)
          showErrorMessage('Cannot create record. Please check the data and try again.');
        };
  };

  export const addModelVersion = async (input) => {
    //const BrokerName = name.value;
    //if (!brokerUserName.value || !brokerPassword.value || !selectedBroker.value)   {
    //  showErrorMessage('Cannot create record. Please enusre all necessary infromation is provided.');
    //  return;
    //}
    /*const input = { 
      brokerLoginBrokerId: selectedBroker.value,
      brokerUserName: brokerUserName.value,
      brokerPassword: brokerPassword.value,
      //owner: $auth.user?.username
     };*/
    try {
          await client.graphql({
            query: createModelVersion,
            variables: { input: input },
          });
        }
    catch(error) {
          console.log('ERROR')
          console.error(error)
          showErrorMessage('Cannot create record. Please check the data and try again.');
        };
  };

  export const delModelVersion = async (id) => {
    try {
        const isConfirmed = window.confirm('Are you sure you want to delete this version? Note any open orders will be closed immediately.');
        if (isConfirmed) {
          await client.graphql({
          query: deleteModelVersion,
          variables: { input: { id } },
        });
      }
    }
    catch(error) {
      console.error(error);
        //showErrorMessage('Cannot delete record. You may not be authorised.');
    }
  };

  export const delModel = async (id, modelVersionIds) => {
    try {
        const isConfirmed = window.confirm('Are you sure you want to delete this model? Note all versions will also be deleted and any open orders will be closed immediately.');
        if (isConfirmed) {

        // Eventually we should create a custom resolver to allow multiple entries to be deleted in a single transaction
        for (const id of modelVersionIds) {
            console.log("deleting versionId: " + id);
            await client.graphql({
                query: deleteModelVersion,
                variables: { input: { id } },
            });
          }
        
          await client.graphql({
          query: deleteModel,
          variables: { input: { id } },
        });    
      }
    }
    catch(error) {
      console.error(error);
        //showErrorMessage('Cannot delete record. You may not be authorised.');
    }
  };

  export const updModelVersion = async (input) => {
    try {
      await client.graphql({
        query: updateModelVersion,
        variables: { input: input },
      });
  
    } catch (error) {
      console.error('Error updating model version:', error);
    } 
  };

  export const updModel = async (input) => {
    try {
      await client.graphql({
        query: updateModel,
        variables: { input: input },
      });
  
    } catch (error) {
      console.error('Error updating model:', error);
    } 
  };
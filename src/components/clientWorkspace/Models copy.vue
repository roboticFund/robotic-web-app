<script setup>
import { generateClient } from "aws-amplify/api";
import { listTradeExecutions, listModelVersions, listBrokerLogins } from "../../graphql/clientWorkspaceQueries";
import {updateTradeExecution, createTradeExecution, deleteTradeExecution} from "../../graphql/mutations";
import { listModels} from "../../graphql/queries";
import { ref, onMounted } from 'vue';
import '../../styles/tables.css';

const client = generateClient();
const name = ref('');
const positionSize = ref(0);
const enterPosition = ref(false);
const exitPosition = ref(false);
const userModels = ref([]);
const userModelsOriginalValues = ref([]);
const brokerName = ref('');
const possibleBrokers = ref([]); 
const allBrokerLogins = ref([]); 
const possibleModels = ref([]); 
const possibleModelVersions = ref([]); 
const selectedBroker = ref(null);
const selectedModel = ref(null);
const selectedModelVersion = ref(null);
const selectedModelVersionEdit = ref(null);
const showUserModelBrokerExistsMessage = ref(false);
const errorMessage = ref('');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkUserModelBrokerExists(name) {
    const variables = {
    filter: {
      name: {
        eq: name
      }
    }
  };
  const result = await client.graphql({
    query: listUserModels,
    variables: variables
  });
  return result.data.listUserModelBrokers.items.length > 0;
}

/*async function toggleEditMode(userModel, index) {
    await fetchModelVersions(userModel.modelVersion.model.id); 
    if (!userModels.value[index].editMode) {
      userModelsOriginalValues[index] = JSON.parse(JSON.stringify(userModel));
    }

    userModels.value[index].editMode = !userModels.value[index].editMode;

     if (userModels.value[index].editMode) {        
      }
      else {
        if (!userModel.isSaving) {
          console.log("NOT SAVING")
          userModels.value[index] = Object.assign({}, userModelsOriginalValues[index]);
          userModelsOriginalValues[index] = null;
        }
        else { userModels.value[index] = userModel[index]}
      }
    };
*/
async function toggleEditMode(userModel, index) {
  await fetchModelVersions(userModel.modelVersion.model.id);

  if (!userModel.editMode) {
    // Enter edit mode
    userModel.originalValues = Object.assign({}, userModel);
    userModel.editMode = true;
    //userModels.value[index] = userModel;
  } else {
    // Exit edit mode
    if (userModel.isSaving) {
      console.log("is Saving");
      // If saving, keep the current values
      //userModel.editMode = false;
      //userModels.value[index] = userModel;
      userModels.value[index] = userModel;
      //userModel.modelVersion.versionNumber = 1;
      userModels.value[index].editMode = false;
      Object.assign(userModel, userModel);
      console.log(userModel);
    } else {
      // If not saving, revert to original values
      Object.assign(userModel, userModel.originalValues);
      userModel.editMode = false;
    }
  }
}

async function showErrorMessage(message) {
  errorMessage.value = message;
  showUserModelBrokerExistsMessage.value = true;
  await sleep(3000);
  showUserModelBrokerExistsMessage.value = false; 
}



/*const saveTrade = async (userModel, index) => {
  try {
    console.log(userModel.modelVersion.id);
    // Update the trade execution with the new brokerLoginID (siteID)
    await client.graphql({query: updateTradeExecution, 
      variables: {
        input: {
          id: userModel.id,
          tradeExecutionModelVersionId: userModel.modelVersion.id,
          tradeExecutionBrokerLoginId: userModel.brokerLogin.id, 
          activeEntry: userModel.activeEntry,
          activeExit: userModel.activeExit,
          positionSize: userModel.positionSize
        }},
      }
    );
    // Update the local state to reflect the changes
    userModels.value = userModels.value.map((userModel) =>
      userModel.id === userModelId
        ? {
            ...userModel,
            Hosting: userModel.Hosting.map((hosting) =>
              hosting.SiteID === siteId
                ? { ...hosting, isActive: !isActive }
                : hosting
            ),
          }
        : userModel
    );
    //userModelsOriginalValues[index] = JSON.parse(JSON.stringify(userModel)); // Set original to current values so display is updated
    //userModelsOriginalValues[index] = userModels[index];
    //userModelsOriginalValues[index].editMode = false;
    //console.log(userModelsOriginalValues[index]);
    //userModelsOriginalValues[index].editMode = !userModelsOriginalValues[index].editMode; // Toggle edit mode so toggleEditMode function correctly executes
    userModel.isSaving = true;
    await toggleEditMode(userModel, index);
  } catch (error) {
    console.error('Error updating site activation:', error);
  } finally {
    userModel.isSaving = false;
  }
};*/

const saveTrade = async (userModel, index) => {
  try {
    userModel.isSaving = true;
    console.log('versionNumber: ');
    console.log(userModel.modelVersion.versionNumber);
    // Update the trade execution with the new brokerLoginID (siteID)
    await client.graphql({query: updateTradeExecution, 
      variables: {
        input: {
          id: userModel.id,
          tradeExecutionModelVersionId: userModel.modelVersion.id,
          tradeExecutionBrokerLoginId: userModel.brokerLogin.id, 
          activeEntry: userModel.activeEntry,
          activeExit: userModel.activeExit,
          positionSize: userModel.positionSize
        }},
      }
    );
    // Update the local state with the edited values
    /*userModels.value = userModels.value.map((userModelItem) =>
      userModelItem.id === userModel.id
        ? {
            ...userModelItem,
            positionSize: userModel.positionSize,
            activeEntry: userModel.activeEntry,
            activeExit: userModel.activeExit,
            modelVersion: {
              ...userModelItem.modelVersion,
              versionNumber: userModel.modelVersion.versionNumber,
            },
          }
        : userModelItem
    );*/
    //userModels.value[index] = Object.assign({}, userModel);


    console.log(userModels.value);
    await toggleEditMode(userModel, index);
  } catch (error) {
    console.error('Error updating site activation:', error);
  } finally {
    userModel.isSaving = false;
  }
};



const fetchUserModels = async () => {
  try {
    //const response = await client.graphql(graphqlOperation(listUserModels));
    const response = await client.graphql({ query: listUserModels });
    userModels.value = response.data.listUserModels.items;
    console.log(userModels.value);
  } catch (error) {
    console.error('Error fetching user models:', error);
  }
};

const fetchTradeExecutions = async () => {
  try {
    console.log(userModels)
    const variables = {
          usermodelID: '63a24160-1d2c-4c6a-bef0-c1087964d884'
    
    };
    //const response = await client.graphql(graphqlOperation(listUserModels));
    //const response = await client.graphql({ query: tradeExecutionsByUsermodelID, variables: variables });
    const response = await client.graphql({ query: listTradeExecutions });
    //userModels.value = response.data.tradeExecutionsByUsermodelID.items;
    userModels.value = response.data.listTradeExecutions.items;
    console.log(userModels.value);
  } catch (error) {
    console.error('Error fetching user models:', error);
  }
};

const fetchBrokers = async () => {
  try {
    const response = await client.graphql({
      query: listBrokerLogins
      /*variables: {
        filter: {
          name: {
            contains: modelName
          }
        }
      }*/
    });
    //console.log("possibleBrokers"+ response.data.listBrokerLogins.items )
    //brokerName.value = response.data.listBrokerLogins.items;
    allBrokerLogins.value = response.data.listBrokerLogins.items;
    console.log("broker logins:")
    console.log(allBrokerLogins.value)
    //console.log(possibleBrokers.value)
    return response.data.listBrokerLogins.items;
  } catch (error) {
    console.error('Error fetching user models by name:', error);
    return [];
  }
};

// Function to extract distinct broker names and IDs
const getDistinctBrokers = async () => {
  const uniqueBrokers = new Map();
  //allBrokerLogins.value = fetchBrokers();
  const allBrokerLogins = await fetchBrokers();
  //userModels.value.forEach(item => {
  allBrokerLogins.forEach(item => {
    const brokerId = item.id;
    const brokerName = item.tradingBroker.name;
    // Use the broker name as the key to ensure uniqueness
    uniqueBrokers.set(brokerName, { id: brokerId, name: brokerName });
  });
  console.log("unique brokers:");
  console.log(uniqueBrokers.values());
  return Array.from(uniqueBrokers.values());
};

const fetchModels = async () => {
  try {
    const response = await client.graphql({
      query: listModels
      /*variables: {
        filter: {
          name: {
            contains: modelName
          }
        }
      }*/
    });
    //console.log("possibleBrokers"+ response.data.listBrokerLogins.items )
    //brokerName.value = response.data.listBrokerLogins.items;
    possibleModels.value = response.data.listModels.items;
    //console.log(possibleBrokers.value)
    return response.data.listModels.items;
  } catch (error) {
    console.error('Error fetching user models by name:', error);
    return [];
  }
};


const fetchModelVersions = async (selectedModel) => {
  try {
    const response = await client.graphql({
      query: listModelVersions,
      variables: {
        filter: {
          modelVersionModelId: {
            eq: selectedModel
          }
        }
      }
    });
    possibleModelVersions.value = response.data.listModelVersions.items;
    //console.log('Possible model versions from fetch:')
    //console.log(possibleModelVersions.value)
    return response.data.listModelVersions.items;
  } catch (error) {
    console.error('Error fetching model versions by model:', error);
    return [];
  }
};

const createTrade = async () => {
  //const BrokerName = name.value;
  //if (!BrokerName) return;
  //const Broker = { name: BrokerName };
  // Check if a Broker with the same name already exists
  //const existingBroker = await checkBrokerExists(BrokerName);
  //if(!existingBroker) {
  const input = { 
    tradeExecutionBrokerLoginId: selectedBroker.value,
    tradeExecutionModelVersionId: selectedModelVersion.value,
    positionSize: positionSize.value,
    activeEntry: enterPosition.value,
    activeExit: exitPosition.value,
   };
  try {
        await client.graphql({
          query: createTradeExecution,
          variables: { input: input },
        });
        // Clear variables
        selectedModel.value = '';
        positionSize.value = '';
        selectedBroker.value = '';
        selectedModelVersion.value = '';
        enterPosition.value = false;
        exitPosition.value = false;

      }
  catch(error) {
        console.log('ERROR')
        console.error(error)
        showErrorMessage('Cannot create record. Please check the data and try again.');
      };
    //name.value = '';
  //} else {
      //showErrorMessage('Broker already exists. Please choose a different name.');
  //  }
  await fetchTradeExecutions();
};

const deleteTrade = async (id) => {
  try {
      const isConfirmed = window.confirm('Are you sure you want to delete this trade? Note any open orders will be closed immediately.');
      if (isConfirmed) {
        await client.graphql({
        query: deleteTradeExecution,
        variables: { input: { id } },
      });
      await fetchTradeExecutions();
    }
  }
  catch {
      showErrorMessage('Cannot delete record. You may not be authorised.');
  }
};

const onBrokerInputChange = async () => {
  //const brokers = await fetchBrokers(brokerName.value);
  //brokerName.possibleBrokers = brokers;
  console.log("Selected Broker: ")
  await console.log(selectedBroker.value)
  //console.log(brokerName.possibleBrokers);
};


const onEnterPositionInputChange = async () => {
  console.log("enteredPosition: ")
  await console.log(enterPosition.value)
};

const onExitPositionInputChange = async () => {
  console.log("exitPosition: ")
  await console.log(exitPosition.value)
};


const onSelectedModelInputChange = async () => {
  console.log("selectedModel: ")
  await console.log(selectedModel.value)
  fetchModelVersions(selectedModel.value);
};

const onAddTradeSubmit = async () => {
  console.log("submitting... ")
  createTrade();
};


onMounted(async () => {
  await fetchTradeExecutions();
  //possibleBrokers.value = await fetchBrokers();
  possibleBrokers.value = await getDistinctBrokers();
  possibleModels.value = fetchModels();
  //console.log("possible brokers next: ")
  //console.log(possibleBrokers.value)
  // initialise form variables
  selectedModel.value = '';
  positionSize.value = '';
  selectedBroker.value = '';
  selectedModelVersion.value = '';
  enterPosition.value = false;
  exitPosition.value = false;
});

</script>

<template>

<div id ="app">
  <!--
      <div>
    <ul>
      <li v-for="userModel in userModels" :key="userModel.id">
        <p>Name: {{ userModel }}</p>
      </li>
    </ul>
  </div>
  -->

        <div v-if="showUserModelBrokerExistsMessage" class="error-message">
          {{errorMessage}}
        </div><br>
        <div class="responsive-table" >
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Version</th>
                <th>Broker</th>
                <th>Position Size</th>
                <th>Enter</th>
                <th>Exit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(userModel, index) in userModels" :key="userModel.id">
                <td>
                  {{ userModel.modelVersion.model.name }} 
                </td>
                <td>
                  <template v-if="userModel.editMode">
                    <!--<select v-model="userModel.modelVersion.id" @change="onSelectedModelVersionInputChange">-->
                    <select v-model="userModel.modelVersion">
                      <option value="" disabled>Select a Version</option>
                      <!--<option v-for="modelVersion in possibleModelVersions" :key="modelVersion.id" :value="modelVersion.id">-->
                      <option v-for="modelVersion in possibleModelVersions" :key="modelVersion.id" :value="modelVersion">
                        {{ modelVersion.versionNumber }}
                        {{ modelVersion.current ? '(current)' : '' }}
                      </option>                    
                    </select>                    
                  </template>
                  <template v-else>
                    {{ userModel.modelVersion.versionNumber }} {{ userModel.modelVersion.current ? '(current)' : '' }}
                  </template>                    
                </td>
                <td>
                  <template v-if="userModel.editMode">
                    <select v-model="userModel.brokerLogin.id">
                      <option value="" disabled>Select a Broker</option>
                      <option v-for="broker in possibleBrokers" :key="broker.id" :value="broker.id">
                        {{ broker.name }}
                      </option>                      
                    </select>              
                  </template>
                  <template v-else>
                    {{ userModel.brokerLogin.tradingBroker.name }}                
                  </template>                  
                </td>
                <td>
                  <template v-if="userModel.editMode">
                    <input v-model="userModel.positionSize" type="text" size="4">           
                  </template>
                  <template v-else>
                    {{ userModel.positionSize }}
                  </template>                                          
                </td>
                <td>
                  <input type="checkbox" :checked="userModel.activeEntry" :disabled="!userModel.editMode" />        
                </td>
                <td>
                  <input type="checkbox" :checked="userModel.activeExit" :disabled="!userModel.editMode" />
                </td>                
                <td>      
                  <span v-if="!userModel.editMode" @click="toggleEditMode(userModel, index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else>
                    <span @click="saveTrade(userModel, index)" class="action-icon">
                      <span class="save-icon">✔️</span>
                    </span>
                    <span @click="toggleEditMode(userModel, index)" class="action-icon">
                      <span class="save-icon">❌</span>
                    </span>                     
                  </span>       
                  <span @click="deleteTrade(userModel.id)" class="action-icon">
                      <span class="delete-icon">🗑️</span>
                  </span>  
                </td>
              </tr>
              <tr>
                <td>
                  <select v-model="selectedModel" @change="onSelectedModelInputChange">
                    <option value="" disabled>Select a Model</option>
                    <option v-for="model in possibleModels" :key="model.id" :value="model.id">
                      {{ model.name }}
                    </option>
                  </select>
                </td>
                <td>
                  <select v-model="selectedModelVersion" @change="onSelectedModelVersionInputChange">
                    <option value="" disabled>Select a Version</option>
                    <option v-for="modelVersion in possibleModelVersions" :key="modelVersion.id" :value="modelVersion.id">
                      {{ modelVersion.versionNumber }}
                      {{ modelVersion.current ? '(current)' : '' }}
                    </option>
                  </select>
                </td>                
                <td>
                  <select v-model="selectedBroker" @change="onBrokerInputChange">
                    <option value="" disabled>Select a broker</option>
                    <option v-for="broker in possibleBrokers" :key="broker.id" :value="broker.id">
                      {{ broker.name }}
                    </option>
                  </select>
                </td>
                <td>
                  <input v-model="positionSize" type="text" size="4">
                </td>
                <td>
                  <input v-model="enterPosition" type="checkbox" @change="onEnterPositionInputChange">
                </td>
                <td>
                  <input v-model="exitPosition" type="checkbox" @change="onExitPositionInputChange">
                </td>                
                <td>      
                  <button v-on:click="onAddTradeSubmit" class="form-button">Add Trade</button>
                </td>                
              </tr>
            </tbody>
          </table>
        </div>
    </div>
    <div id="to do">
      <h3>Show a list of logged in users models. From requirements to include:
        <ul>
          <li>Active flag (Req #5, #6, #7). Enable user to toggle model on/off (global for all UserModelBrokers), or stop entries and exits independently</li>
          <li>Adjust position sizing (Req #8). Should this be here or in a seperate page? Also consider dynamic sizing requirement (#21) and overlap with req #18</li>
          <li>Req#18 Be able to control position sizing and turning on/off trading per decision engine and account. Implement as UserModelBroker related list?</li>
          <li>Req#17 Have the ability to have multiple algorithms across different markets. Implement as model "applies to" related list</li>
          <li>Req#15 Be notified of a new trade rather than the system automatically booking it. Should this be here or another page?</li>
          <li>Req#16 Add an approval step before the the trade is placed. Should this be here or another page?</li>
          <li>Number of trades</li>
          <li>Win rate</li>
          <li>Req#1. See results of my trades over time. Could we just use UserModelBroker APIs to retrieve the data on request using date filters?</li>
          <li>Req#4. Version? Should we show historical versions and each versions win rates, number of trades, etc? I think so</li>
        </ul>
      </h3>
    </div>
</template>


<style scoped>

</style>






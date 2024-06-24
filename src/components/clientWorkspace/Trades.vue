<script setup>
import { generateClient } from "aws-amplify/api";
import { listTradeExecutions, listModelVersions, listBrokerLogins } from "../../graphql/customQueries";
import {updateTradeExecution, createTradeExecution, deleteTradeExecution} from "../../graphql/mutations";
import { listModels} from "../../graphql/queries";
import { ref, onMounted } from 'vue';
import '../../styles/tables.css';

const client = generateClient();
const positionSize = ref(0);
const enterPosition = ref(false);
const exitPosition = ref(false);
const tradeSettings = ref([]);
const possibleBrokers = ref([]); 
const allBrokerLogins = ref([]); 
const possibleModels = ref([]); 
const possibleModelVersions = ref([]); 
const newPossibleModelVersions = ref([]); 
const allModelVersions = ref([]); 
const selectedBroker = ref(null);
const selectedModel = ref(null);
const selectedModelVersion = ref(null);
const showUserModelBrokerExistsMessage = ref(false);
const errorMessage = ref('');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const currentUser = ref('');


async function toggleEditMode(tradeSetting, index) {
  if (!tradeSetting.editMode) {
    // Copy original contents to restore when user exits without saving
    tradeSetting.originalValues = JSON.parse(JSON.stringify(tradeSetting));   
    tradeSetting.selectedModelId = tradeSetting.ModelVersion.model.id;
    tradeSetting.ModelVersions = await fetchModelVersions(tradeSetting.selectedModelId);
    tradeSetting.editMode = true;
    tradeSetting.ModelVersions.value = tradeSetting.ModelVersion.id;
  } else {
    // Exit edit mode
    if (tradeSetting.isSaving) {
      tradeSettings.value[index].editMode = false;
    } else {
      // If not saving, revert to original values
      console.log("undo");
      console.log(tradeSetting.originalValues);
      Object.assign(tradeSetting, tradeSetting.originalValues);
      tradeSetting.originalValues = '';
      tradeSetting.editMode = false;
    }
  }
}

async function showErrorMessage(message) {
  errorMessage.value = message;
  showUserModelBrokerExistsMessage.value = true;
  await sleep(3000);
  showUserModelBrokerExistsMessage.value = false; 
}


const saveTrade = async (tradeSetting, index) => {
  try {
    tradeSetting.isSaving = true;
    console.log('versionNumber: ');
    console.log(tradeSetting.ModelVersion.versionNumber);
    // Update the trade execution with the new brokerLoginID (siteID)
    await client.graphql({query: updateTradeExecution, 
      variables: {
        input: {
          id: tradeSetting.id,
          tradeExecutionModelVersionId: tradeSetting.ModelVersion.id,
          tradeExecutionBrokerLoginId: tradeSetting.brokerLogin.id, 
          activeEntry: tradeSetting.activeEntry,
          activeExit: tradeSetting.activeExit,
          positionSize: tradeSetting.positionSize
        }},
      }
    );

    //Find and set broker name variable when exiting edit mode so it aligns with selected ID
    const savedBroker = possibleBrokers.value.find(item => item.id === tradeSetting.brokerLogin.id);
    tradeSetting.brokerLogin.broker.name = savedBroker.name;  // Set broker id read-only field
    const savedModelVersion = allModelVersions.value.find(item => item.id === tradeSetting.ModelVersion.id);
    tradeSetting.ModelVersion.versionNumber = savedModelVersion.versionNumber;
    tradeSetting.ModelVersion.current = savedModelVersion.current;

    console.log(tradeSettings.value);
    await toggleEditMode(tradeSetting, index);
  } catch (error) {
    console.error('Error updating site activation:', error);
  } finally {
    tradeSetting.isSaving = false;
  }
};

const fetchTradeExecutions = async () => {
  try {
    const response = await client.graphql({ query: listTradeExecutions });
    //tradeSettings.value = response.data.tradeExecutionsByUsermodelID.items;
    tradeSettings.value = response.data.listTradeExecutions.items;
    console.log("UserModels: ");
    console.log(tradeSettings.value);
  } catch (error) {
    console.error('Error fetching user models:', error);
  }
};

const fetchBrokers = async () => {
  try {
    const response = await client.graphql({
      query: listBrokerLogins
    });
    allBrokerLogins.value = response.data.listBrokerLogins.items;
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
  //tradeSettings.value.forEach(item => {
  allBrokerLogins.forEach(item => {
    const brokerId = item.id;
    const brokerName = item.broker.name;
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
    });
    possibleModels.value = response.data.listModels.items;
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
    //$auth.user?.usernames
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
  newPossibleModelVersions.value = await fetchModelVersions(selectedModel.value);
};

const onAddTradeSubmit = async () => {
  console.log("submitting... ")
  createTrade();
};


onMounted(async () => {
  await fetchTradeExecutions();
  possibleBrokers.value = await getDistinctBrokers();
  possibleModels.value = fetchModels();
  allModelVersions.value = await fetchModelVersions();
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
  
      <div>
    <ul>
      <li v-for="tradeSetting in tradeSettings" :key="tradeSetting.id">
        <p>Name: {{ tradeSetting }}</p>
      </li>
    </ul>
  </div>
  

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
              <tr v-for="(tradeSetting, index) in tradeSettings" :key="tradeSetting.id">
                <td>
                  {{ tradeSetting.ModelVersion.model.name }} 
                </td>
                <td>
                  <template v-if="tradeSetting.editMode">
                    <!--<select v-model="tradeSetting.ModelVersion.id" @change="onSelectedModelVersionInputChange">-->
                    <select v-model="tradeSetting.ModelVersion.id">
                      <option value="" disabled>Select a Version</option>
                      <!--<option v-for="ModelVersion in possibleModelVersions" :key="ModelVersion.id" :value="ModelVersion.id">-->
                      <!--<option v-for="ModelVersion in possibleModelVersions" :key="ModelVersion.id" :value="ModelVersion">-->
                      <option v-for="ModelVersion in tradeSetting.ModelVersions" :key="ModelVersion.id" :value="ModelVersion.id">                        
                        {{ ModelVersion.versionNumber }}
                        {{ ModelVersion.current ? '(current)' : '' }}
                      </option>                    
                    </select>                    
                  </template>
                  <template v-else>
                    {{ tradeSetting.ModelVersion.versionNumber }} {{ tradeSetting.ModelVersion.current ? '(current)' : '' }}
                  </template>                    
                </td>
                <td>
                  <template v-if="tradeSetting.editMode">
                    <select v-model="tradeSetting.brokerLogin.id">
                      <option value="" disabled>Select a Broker</option>
                      <option v-for="broker in possibleBrokers" :key="broker.id" :value="broker.id">
                        {{ broker.name }}
                      </option>                      
                    </select>              
                  </template>
                  <template v-else>
                    {{ tradeSetting.brokerLogin.broker.name }}                
                  </template>                  
                </td>
                <td>
                  <template v-if="tradeSetting.editMode">
                    <input v-model="tradeSetting.positionSize" type="text" size="4">           
                  </template>
                  <template v-else>
                    {{ tradeSetting.positionSize }}
                  </template>                                          
                </td>
                <td>
                  <input type="checkbox" v-model="tradeSetting.activeEntry" :checked="tradeSetting.activeEntry" :disabled="!tradeSetting.editMode" />        
                </td>
                <td>
                  <input type="checkbox" v-model="tradeSetting.activeExit" :checked="tradeSetting.activeExit" :disabled="!tradeSetting.editMode" />
                </td>                
                <td>      
                  <span v-if="!tradeSetting.editMode" @click="toggleEditMode(tradeSetting, index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else>
                    <span @click="saveTrade(tradeSetting, index)" class="action-icon">
                      <span class="save-icon">✔️</span>
                    </span>
                    <span @click="toggleEditMode(tradeSetting, index)" class="action-icon">
                      <span class="save-icon">❌</span>
                    </span>                     
                  </span>       
                  <span @click="deleteTrade(tradeSetting.id)" class="action-icon">
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
                    <option v-for="ModelVersion in newPossibleModelVersions" :key="ModelVersion.id" :value="ModelVersion.id">
                      {{ ModelVersion.versionNumber }}
                      {{ ModelVersion.current ? '(current)' : '' }}
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






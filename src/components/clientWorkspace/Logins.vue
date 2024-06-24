<script setup>
import { generateClient } from "aws-amplify/api";
import { listBrokerLogins } from "../../graphql/customQueries";
import {updateBrokerLogin, createBrokerLogin, deleteBrokerLogin} from "../../graphql/mutations";
import { listBrokers} from "../../graphql/queries";
import { ref, computed, onMounted } from 'vue';
import { getCurrentUser } from 'aws-amplify/auth';
import '../../styles/tables.css';

const client = generateClient();
const positionSize = ref(0);
const enterPosition = ref(false);
const exitPosition = ref(false);
const logins = ref([]);
const brokerUserName = ref('');
const brokerPassword = ref('');
const allBrokers = ref([]); 
const newPossibleModelVersions = ref([]); 
const selectedBroker = ref(null);
const selectedModel = ref(null);
const selectedModelVersion = ref(null);
const showLoginBrokerExistsMessage = ref(false);
const errorMessage = ref('');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const currentUser = ref('');

const computedBrokersWithoutLogins = computed(() => {
  return allBrokers.value.filter(broker => {
    return !logins.value.some(login => login.broker && login.broker.id === broker.id);
  });
});


async function toggleEditMode(login, index) {
  if (!login.editMode) {
    // Copy original contents to restore when user exits without saving
    login.originalValues = JSON.parse(JSON.stringify(login));   
    login.editMode = true;
  } else {
    // Exit edit mode
    if (login.isSaving) {
      logins.value[index].editMode = false;
    } else {
      // If not saving, revert to original values
      console.log("undo");
      console.log(login.originalValues);
      Object.assign(login, login.originalValues);
      login.originalValues = '';
      login.editMode = false;
    }
  }
}

async function showErrorMessage(message) {
  errorMessage.value = message;
  showLoginBrokerExistsMessage.value = true;
  await sleep(3000);
  showLoginBrokerExistsMessage.value = false; 
}

const fetchLogins = async () => {
  try {
    const response = await client.graphql({ query: listBrokerLogins });
    logins.value = response.data.listBrokerLogins.items;
    console.log(logins.value);
  } catch (error) {
    console.error('Error fetching logins:', error);
  }
};


// Rename to save login
const saveLogin = async (login, index) => {
  try {
    login.isSaving = true;
    console.log('login: ');
    console.log(login);
    // Update the trade execution with the new brokerLoginID (siteID)
    await client.graphql({query: updateBrokerLogin, 
      variables: {
        input: {
          id: login.id,
          brokerUserName: login.brokerUserName,
          brokerPassword: login.brokerPassword, 
        }},
      }
    );

    console.log(logins.value);
    await toggleEditMode(login, index);
  } catch (error) {
    console.error('Error updating login:', error);
  } finally {
    login.isSaving = false;
  }
};

const fetchBrokers = async () => {
  try {
    const response = await client.graphql({
      query: listBrokers
    });
    allBrokers.value = response.data.listBrokers.items;
    console.log("Brokers:")
    console.log(allBrokers.value)
    //console.log(possibleBrokers.value)
    return response.data.listBrokers.items;
  } catch (error) {
    console.error('Error fetching Brokers:', error);
    return [];
  }
};


const createLogin = async () => {
  //const BrokerName = name.value;
  if (!brokerUserName.value || !brokerPassword.value || !selectedBroker.value)   {
    showErrorMessage('Cannot create record. Please enusre all necessary infromation is provided.');
    return;
  }
  const input = { 
    brokerLoginBrokerId: selectedBroker.value,
    brokerUserName: brokerUserName.value,
    brokerPassword: brokerPassword.value,
    //owner: $auth.user?.username
   };
  try {
        await client.graphql({
          query: createBrokerLogin,
          variables: { input: input },
        });
        brokerUserName.value = '';
        brokerPassword.value = '';
      }
  catch(error) {
        console.log('ERROR')
        console.error(error)
        showErrorMessage('Cannot create record. Please check the data and try again.');
      };
  await fetchLogins();
};

// rename to delete Login
const deleteLogin = async (id) => {
  try {
      const isConfirmed = window.confirm('Are you sure you want to delete this login? Note any open orders will be closed immediately.');
      if (isConfirmed) {
        await client.graphql({
        query: deleteBrokerLogin,
        variables: { input: { id } },
      });
      await fetchLogins();
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

const onAddLoginSubmit = async () => {
  console.log("submitting... ")
  createLogin();
};


onMounted(async () => {
  //await fetchTradeExecutions();
  //possibleBrokers.value = await fetchBrokers();
  await fetchLogins();
  allBrokers.value = await fetchBrokers();
  console.log("clientData: ")
  //const auth = app.auth
  currentUser.value = await getCurrentUser();
  //const auth = ;
  console.log(currentUser.value.userId);
  //console.log(possibleBrokers.value)
  // initialise form variables
  selectedModel.value = '';
  positionSize.value = '';
  selectedBroker.value = '';
  selectedModelVersion.value = '';
  enterPosition.value = false;
  exitPosition.value = false;
  console.log(computedBrokersWithoutLogins.value);
});

</script>

<template>

<div id ="app">
  
      <div>
    <ul>
      <li v-for="login in logins" :key="login.id">
        <p>Name: {{ login }}</p>
      </li>
    </ul>
  </div>
  

        <div v-if="showLoginBrokerExistsMessage" class="error-message">
          {{errorMessage}}
        </div><br>
        <div class="responsive-table" >
          <table>
            <thead>
              <tr>
                <th>Broker</th>
                <th>UserName</th>
                <th>Password</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(login, index) in logins" :key="login.id">
                <td>
                    {{ login.broker.name }}                
                </td>
                <td>
                  <template v-if="login.editMode">
                    <input v-model="login.brokerUserName" type="text" size="20">           
                  </template>
                  <template v-else>
                    {{ login.brokerUserName }}
                  </template>                                          
                </td>
                <td>
                  <template v-if="login.editMode">
                    <input v-model="login.brokerPassword" type="text" size="20">           
                  </template>
                  <template v-else>
                    {{ login.brokerPassword }}
                  </template>                                          
                </td>                   
                <td>      
                  <span v-if="!login.editMode" @click="toggleEditMode(login, index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else>
                    <span @click="saveLogin(login, index)" class="action-icon">
                      <span class="save-icon">✔️</span>
                    </span>
                    <span @click="toggleEditMode(login, index)" class="action-icon">
                      <span class="save-icon">❌</span>
                    </span>                     
                  </span>       
                  <span @click="deleteLogin(login.id)" class="action-icon">
                      <span class="delete-icon">🗑️</span>
                  </span>  
                </td>
              </tr>
              <tr v-if="computedBrokersWithoutLogins.length > 0">             
                <td>
                  <select v-model="selectedBroker" @change="onBrokerInputChange">
                    <option value="" disabled>Select a broker</option>
                    <option v-for="broker in computedBrokersWithoutLogins" :key="broker.id" :value="broker.id">
                      {{ broker.name }}
                    </option>
                  </select>
                </td>
                <td>
                  <input v-model="brokerUserName" type="text" size="20">
                </td>
                <td>
                  <input v-model="brokerPassword" type="text" size="20">
                </td>              
                <td>      
                  <button v-on:click="onAddLoginSubmit" class="form-button">Add Login</button>
                </td>                
              </tr>
            </tbody>
          </table>
        </div>
    </div>
</template>


<style scoped>

</style>






<script setup>
import { generateClient } from "aws-amplify/api";
import { listBrokers, getBroker} from "../../graphql/queries";
import { createBroker, updateBroker, deleteBroker } from "../../graphql/mutations";
import { onCreateBroker } from "../../graphql/subscriptions";
import { ref, onMounted } from 'vue';
//import { AmplifyButton, AmplifyTextField } from '@aws-amplify/ui-vue';
import '../../styles/tables.css';

const client = generateClient();
const name = ref('');
const Brokers = ref([]);
const showBrokerExistsMessage = ref(false);
const errorMessage = ref('');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkBrokerExists(name) {
    const variables = {
    filter: {
      name: {
        eq: name
      }
    }
  };
  const result = await client.graphql({
    query: listBrokers,
    variables: variables
  });
  return result.data.listBrokers.items.length > 0;
}

function toggleEditMode(item, index) {  
      item.editMode = !item.editMode;
      if (item.editMode) {
        item.editedName = item.name; // Initialize editedName with current value
      }
      /*this.Brokers[index].editMode = !this.Brokers[index].editMode;
      if (this.Brokers[index].editMode) {
        this.Brokers[index].editedName = this.Brokers[index].name; // Initialize editedName with current value
      }*/
    };


async function showErrorMessage(message) {
  errorMessage.value = message;
  showBrokerExistsMessage.value = true;
  await sleep(3000);
  showBrokerExistsMessage.value = false; 
}

const createBrokers = async () => {
  const BrokerName = name.value;
  if (!BrokerName) return;
  const Broker = { name: BrokerName };
  // Check if a Broker with the same name already exists
  const existingBroker = await checkBrokerExists(BrokerName);
  if(!existingBroker) {
    try {
          await client.graphql({
            query: createBroker,
            variables: { input: Broker },
          });
        }
    catch {
          showErrorMessage('Cannot create record. You may not be authorised.');
        };
    name.value = '';
  } else {
      showErrorMessage('Broker already exists. Please choose a different name.');
    }
};

const saveBroker = async (item, index) => {
  const BrokerName = item.editedName;
  const currentName = item['name'];
  if (!BrokerName || (BrokerName==currentName)) {     // Null or same value received so do nothing and exit edit mode
    showErrorMessage('Broker not updated.');
    Brokers.value[index].editMode = false; // Exit edit mode  
    return;
  }
  const existingBroker = await checkBrokerExists(BrokerName);
  if(existingBroker) {
    showErrorMessage('A Broker already exists with this name.');
    Brokers.value[index].editMode = false; // Exit edit mode  
    return;
  }
  try {
    await client.graphql({
      query: updateBroker,
      variables: { input: { id: item.id, name: BrokerName } },
    });
    Brokers.value[index].editMode = false;
    item.name=BrokerName; //update display field to align with commited update
  }
  catch {
      showErrorMessage('Cannot update record. You may not be authorised.');  
      Brokers.value[index].editMode = false;
  }
  //getBrokerList(); // Dont need to get the whole list again
};

   
const subscribe = () => {
  client.graphql({ query: onCreateBroker }).subscribe({
    next: (eventData) => {
      const Broker = eventData.data.onCreateBroker;
      if (!Brokers.value.some((item) => item.name === Broker.name)) {
        Brokers.value.push(Broker);
      }
    },
  });
};


const deleteBrokers = async (id) => {
  try {
      await client.graphql({
      query: deleteBroker,
      variables: { input: { id } },
    });
    getBrokerList();
  }
  catch {
      showErrorMessage('Cannot delete record. You may not be authorised.');
  }
};

const getBrokerList = async () => {
    const response = await client.graphql({ query: listBrokers });
    Brokers.value = response.data.listBrokers.items;
}

onMounted(() => {
  getBrokerList();
  subscribe();
});

</script>

<template>
    <div id ="app">
        <div v-if="showBrokerExistsMessage" class="error-message">
          {{errorMessage}}
        </div><br>
        <div class="form-container">
          <input type="text" v-model="name" placeholder="Broker name" class="form-input"/>
          <button v-on:click="createBrokers" class="form-button">Create Broker</button>
          <!--<amplify-button v-on:click="createBrokers" class="form-button">Create Broker</amplify-button><br>-->
        </div>
        <br>
        <div class="responsive-table" >
          <table>
            <thead>
              <tr>
                <th>Broker Name</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in Brokers" :key="item.id">
                <td>
                  <template v-if="item.editMode">
                    <input v-model="item.editedName" />
                  </template>
                  <template v-else>
                    {{ item.name }}
                  </template>  
                </td>
                <td>      
                  <span v-if="!item.editMode" @click="toggleEditMode(item, index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else @click="saveBroker(item, index)" class="action-icon">
                    <span class="save-icon">✔️</span>
                  </span>
                  <span @click="deleteBrokers(item.id)" class="action-icon">
                    <span class="delete-icon">🗑️</span>
                  </span>             
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </div>
    
</template>


<style scoped>

</style>

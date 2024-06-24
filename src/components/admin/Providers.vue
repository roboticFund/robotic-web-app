<script setup>
import { generateClient } from "aws-amplify/api";
import { listProviders, getProvider} from "../../graphql/queries";
import { createProvider, updateProvider, deleteProvider } from "../../graphql/mutations";
import { onCreateProvider } from "../../graphql/subscriptions";
import { ref, onMounted } from 'vue';
//import { AmplifyButton, AmplifyTextField } from '@aws-amplify/ui-vue';
import '../../styles/tables.css';

const client = generateClient();
const name = ref('');
const Providers = ref([]);
const showProviderExistsMessage = ref(false);
const errorMessage = ref('');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkProviderExists(name) {
    const variables = {
    filter: {
      name: {
        eq: name
      }
    }
  };
  const result = await client.graphql({
    query: listProviders,
    variables: variables
  });
  return result.data.listProviders.items.length > 0;
}

function toggleEditMode(index) {
      this.Providers[index].editMode = !this.Providers[index].editMode;
      if (this.Providers[index].editMode) {
        this.Providers[index].editedName = this.Providers[index].name; // Initialize editedName with current value
      }
    };


async function showErrorMessage(message) {
  errorMessage.value = message;
  showProviderExistsMessage.value = true;
  await sleep(3000);
  showProviderExistsMessage.value = false; 
}

const createProviders = async () => {
  const ProviderName = name.value;
  if (!ProviderName) return;
  const Provider = { name: ProviderName };
  // Check if a Provider with the same name already exists
  const existingProvider = await checkProviderExists(ProviderName);
  if(!existingProvider) {
    try {
          await client.graphql({
            query: createProvider,
            variables: { input: Provider },
          });
        }
    catch {
          showErrorMessage('Cannot create record. You may not be authorised.');
        };
    name.value = '';
  } else {
      showErrorMessage('Provider already exists. Please choose a different name.');
    }
};

const saveProvider = async (item, index) => {
  const ProviderName = item.editedName;
  const currentName = item['name'];
  if (!ProviderName || (ProviderName==currentName)) {     // Null or same value received so do nothing and exit edit mode
    showErrorMessage('Provider not updated.');
    Providers.value[index].editMode = false; // Exit edit mode  
    return;
  }
  const existingProvider = await checkProviderExists(ProviderName);
  if(existingProvider) {
    showErrorMessage('A Provider already exists with this name.');
    Providers.value[index].editMode = false; // Exit edit mode  
    return;
  }
  try {
    await client.graphql({
      query: updateProvider,
      variables: { input: { id: item.id, name: ProviderName } },
    });
    Providers.value[index].editMode = false;
    item.name=ProviderName; //update display field to align with commited update
  }
  catch {
      showErrorMessage('Cannot update record. You may not be authorised.');  
      Providers.value[index].editMode = false;
  }
  //getProviderList(); // Dont need to get the whole list again
};

   
const subscribe = () => {
  client.graphql({ query: onCreateProvider }).subscribe({
    next: (eventData) => {
      const Provider = eventData.data.onCreateProvider;
      if (!Providers.value.some((item) => item.name === Provider.name)) {
        Providers.value.push(Provider);
      }
    },
  });
};


const deleteProviders = async (id) => {
  try {
      await client.graphql({
      query: deleteProvider,
      variables: { input: { id } },
    });
    getProviderList();
  }
  catch {
      showErrorMessage('Cannot delete record. You may not be authorised.');
  }
};

const getProviderList = async () => {
    const response = await client.graphql({ query: listProviders });
    Providers.value = response.data.listProviders.items;
}

onMounted(() => {
  getProviderList();
  subscribe();
});

</script>

<template>
    <div id ="app">
        <div v-if="showProviderExistsMessage" class="error-message">
          {{errorMessage}}
        </div><br>
        <div class="form-container">
          <input type="text" v-model="name" placeholder="Provider name" class="form-input"/>
          <button v-on:click="createProviders" class="form-button">Create Provider</button>
          <!--<amplify-button v-on:click="createProviders" class="form-button">Create Provider</amplify-button><br>-->
        </div>
        <br>
        <div class="responsive-table" >
          <table>
            <thead>
              <tr>
                <th>Provider Name</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in Providers" :key="item.id">
                <td>
                  <template v-if="item.editMode">
                    <input v-model="item.editedName" />
                  </template>
                  <template v-else>
                    {{ item.name }}
                  </template>  
                </td>
                <td>      
                  <span v-if="!item.editMode" @click="toggleEditMode(index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else @click="saveProvider(item, index)" class="action-icon">
                    <span class="save-icon">✔️</span>
                  </span>
                  <span @click="deleteProviders(item.id)" class="action-icon">
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

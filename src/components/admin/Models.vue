<script setup>
import { ref, provide, onMounted } from 'vue';
import '../../styles/tables.css';
import ModelVersions from './ModelVersions.vue';
import { fetchModels, fetchProviders, addModel, fetchModelVersions, delModel, updModel } from '../../graphql/API.js';

const models = ref([]);
const positionSize = ref(0);
const enterPosition = ref(false);
const exitPosition = ref(false);
const modelName = ref('');
const modelDescription = ref('');
const modelPrice = ref('');
const providers = ref([]); 
const selectedProvider = ref(null);
const selectedModel = ref(null);
const selectedModelVersion = ref(null);
const showLoginBrokerExistsMessage = ref(false);
const errorMessage = ref('');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const selectedItemId = ref(null);
const versions = ref([]);


const getRelatedItems = async(itemId) => {
  versions.value = await fetchModelVersions(itemId);
  return versions.value;
};
provide('getRelatedItems', getRelatedItems);
provide('versions', versions);

const toggleSubTable = (itemId) => {
  selectedItemId.value = selectedItemId.value === itemId ? null : itemId;
};

const onToggleSubTable = (model) => {
    toggleSubTable(model.id);
    if (model.editMode) {
        toggleEditMode(model)
    }
  //if (showSubTable) {
   // getRelatedItems(model.id);
  //}
};

const deleteModel = async (id) => {
    await getRelatedItems(id);
    const modelVersionIds = versions.value.map((modelVersion) => modelVersion.id);
    await delModel(id, modelVersionIds);
    models.value = await fetchModels();
};

async function toggleEditMode(model, index) {
  if (!model.editMode) {
    // Copy original contents to restore when user exits without saving
    model.originalValues = JSON.parse(JSON.stringify(model));   
    model.editMode = true;
  } else {
    // If not saving, revert to original values
    Object.assign(model, model.originalValues);
    model.originalValues = '';
    model.editMode = false;
  }
}

async function showErrorMessage(message) {
  errorMessage.value = message;
  showLoginBrokerExistsMessage.value = true;
  await sleep(3000);
  showLoginBrokerExistsMessage.value = false; 
}
provide('showErrorMessage', showErrorMessage);

const saveModel = async (model) => {
  if (!model.name || !model.description || !model.price)   {
    showErrorMessage('Cannot create record. Please ensure all necessary information is provided.');
    return;
  }
  const input = { 
    id: model.id,
    name: model.name,
    description: model.description,
    price: model.price,
   };
  await updModel(input);
  models.value = await fetchModels();
};


const createModel = async () => {
  if ( !selectedProvider.value || !modelName.value || !modelDescription.value || !modelPrice.value)   {
    showErrorMessage('Cannot create record. Please enusre all necessary infromation is provided.');
    return;
  }
  const input = { 
    modelProviderId: selectedProvider.value,
    name: modelName.value,
    description: modelDescription.value,
    price: modelPrice.value
   };
  await addModel(input);
  models.value = await fetchModels();  
};


const onProviderInputChange = async () => {

};

const onAddModelSubmit = async () => {
  console.log("submitting... ")
  createModel();
  modelName.value = '';
  modelDescription.value = '';
  modelPrice.value = '';
};


onMounted(async () => {
  providers.value = await fetchProviders();
  models.value = await fetchModels();
  selectedModel.value = '';
  positionSize.value = '';
  selectedProvider.value = '';
  selectedModelVersion.value = '';
  enterPosition.value = false;
  exitPosition.value = false;
});

</script>

<template>

<div id ="app">
        <div v-if="showLoginBrokerExistsMessage" class="error-message">
          {{errorMessage}}
        </div><br>
        <div class="responsive-table" >
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Name</th>
                <th style="width: 1px; white-space: nowrap;">Version</th>
                <th>Description</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <!--<div v-for="(model, index) in models" :key="model.id">-->
              <template v-for="(model, index) in models" :key="model.id">
              <!--<tr v-for="(model, index) in models" :key="model.id" :class="{ 'bold-row': selectedItemId === model.id}">-->
              <tr :class="{ 'bold-row': selectedItemId === model.id }">
                <td>
                    {{ model.provider.name }}                
                </td>
                <td>
                  <template v-if="model.editMode">
                    <input v-model="model.name" type="text" size="20">           
                  </template>
                  <template v-else>
                    {{ model.name }}
                  </template>                                          
                </td>
                <td>
                  <button class="form-button" @click="onToggleSubTable(model)">
                      <template v-if="selectedItemId === model.id">-</template><template v-else>+</template>
                  </button>
                </td>
                <td>
                  <template v-if="model.editMode">
                    <input v-model="model.description" type="text" size="20">           
                  </template>
                  <template v-else>
                    {{ model.description }}
                  </template>                                          
                </td> 
                <td>
                  <template v-if="model.editMode">
                    <input v-model="model.price" type="text" size="6">           
                  </template>
                  <template v-else>
                    {{ model.price }}
                  </template>                                          
                </td>                                 
                <td>  
                  <template v-if="selectedItemId !== model.id">      
                  <span v-if="!model.editMode" @click="toggleEditMode(model, index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else>
                    <span @click="saveModel(model, index)" class="action-icon">
                      <span class="save-icon">✔️</span>
                    </span>
                    <span @click="toggleEditMode(model, index)" class="action-icon">
                      <span class="save-icon">❌</span>
                    </span>                     
                  </span>       
                  <span @click="deleteModel(model.id)" class="action-icon">
                      <span class="delete-icon">🗑️</span>
                  </span>  
                  </template>  
                </td>
              </tr>
              <tr v-if="selectedItemId === model.id">
                <td colspan="4">
                  <ModelVersions
                    :key="'model-versions-' + model.id"
                    :item="model"
                    :showSubTable="selectedItemId === model.id"
                    :toggleSubTable="toggleSubTable"/>
                </td>
              </tr>
              </template>
              <tr>             
                <td>
                  <select v-model="selectedProvider" @change="onProviderInputChange">
                    <option value="" disabled>Select a provider</option>
                    <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                      {{ provider.name }}
                    </option>
                  </select>
                </td>
                <td>
                  <input v-model="modelName" type="text" size="20">
                </td>
                <td></td>
                <td>
                  <input v-model="modelDescription" type="text" size="20">
                </td>              
                <td>
                  <input v-model="modelPrice" type="text" size="10">
                </td>                    
                <td>      
                  <button v-on:click="onAddModelSubmit" class="form-button">Add Model</button>
                </td>                
              </tr>
            </tbody>
          </table>
        </div>
    </div>
</template>


<style scoped>
  tr.bold-row {
    color: #fff;
    background-color: #6fa1c2;
  }
</style>






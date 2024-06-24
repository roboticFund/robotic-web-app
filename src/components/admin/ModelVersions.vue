<script setup>
import { ref, onMounted, defineProps, watchEffect, inject  } from 'vue';
import { addModelVersion, delModelVersion, updModelVersion } from '../../graphql/API.js';

const { item, showSubTable, toggleSubTable } = defineProps(['item', 'showSubTable', 'toggleSubTable', 'versions']);

const getRelatedItems = inject('getRelatedItems', null);
const versions = inject('versions', null);
const showErrorMessage = inject('showErrorMessage', null);

const deleteVersion = async (id) => {
    await delModelVersion(id);
    getRelatedItems(item.id);
};

// Watch for changes in showSubTable using watchEffect
watchEffect(() => {
    if (showSubTable) {
        getRelatedItems(item.id);
  }
});

async function toggleEditMode(version, index) {
  if (!version.editMode) {
    // Copy original contents to restore when user exits without saving
    version.originalValues = JSON.parse(JSON.stringify(version));   
    version.editMode = true;
  } else {
    // Exit edit mode
    if (version.isSaving) {
        version.value[index].editMode = false;
    } else {
      // If not saving, revert to original values
      Object.assign(version, version.originalValues);
      version.originalValues = '';
      version.editMode = false;
    }
  }
}


// Assuming all columns are present in the main table
const columnCount = 4; // Adjust based on the number of columns in the main table
const versionNumber = ref('');
const current = ref('');

const onAddVersionSubmit = async (model) => {
  await createModelVersion(model);
  versionNumber.value = '';
  current.value = '';
  getRelatedItems(item.id);
};

const createModelVersion = async (model) => {
  if (!versionNumber.value)   {
    showErrorMessage('Cannot create record. Please ensure all necessary information is provided.');
    return;
  }
  const input = { 
    modelVersionModelId: model,
    versionNumber: versionNumber.value,
    current: current.value,
   };
  await addModelVersion(input);
};

const saveVersion = async (version) => {
  if (!version.versionNumber)   {
    showErrorMessage('Cannot create record. Please ensure all necessary information is provided.');
    return;
  }
  const input = { 
    id: version.id,
    versionNumber: version.versionNumber,
    current: version.current,
   };
  await updModelVersion(input);
  getRelatedItems(item.id);
};

onMounted(async () => {

});



</script>

<template>
  <div v-if="showSubTable" class="sub-table-container">
        <table>
          <thead>
            <tr>
              <th>Vesion Number</th>
              <th>Current</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="relatedItem in versions" :key="'relatedItem' + relatedItem.id">
              <td>
                <template v-if="relatedItem.editMode">
                    <input v-model="relatedItem.versionNumber" type="text" size="5">           
                </template>
                <template v-else>
                    {{ relatedItem.versionNumber }}
                </template>                   
              </td>
              <td>
                <input type="checkbox" v-model="relatedItem.current" :checked="relatedItem.current" :disabled="!relatedItem.editMode" />   
              </td>
              <td>
                <span v-if="!relatedItem.editMode" @click="toggleEditMode(relatedItem, index)" class="action-icon">
                    <span class="edit-icon">✏️</span>
                  </span>           
                  <span v-else>
                    <span @click="saveVersion(relatedItem, index)" class="action-icon">
                      <span class="save-icon">✔️</span>
                    </span>
                    <span @click="toggleEditMode(relatedItem, index)" class="action-icon">
                      <span class="save-icon">❌</span>
                    </span>                     
                  </span>       
                  <span @click="deleteVersion(relatedItem.id)" class="action-icon">
                      <span class="delete-icon">🗑️</span>
                  </span>                  
              </td>              
              <!-- Add more columns as needed -->
            </tr>
            <tr>
                <td><input v-model="versionNumber" type="text" size="5"></td>
                <td><input v-model="current" type="checkbox"></td>
                <td><button v-on:click="onAddVersionSubmit(item.id)" class="form-button">Add Version</button></td>
            </tr>
          </tbody>
        </table>
</div>
</template>

<style scoped>
.sub-table-container {
  background-color: #f8f8f8;
  border: 0px solid #ccc;
  padding: 2px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
.responsive-table {
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    overflow: hidden;
  }
  
  thead {
    background-color: #6fa1c2;
    color: #fff;
  }
  th, td {
    padding: 5px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  .form-button {
    padding: 8px 12px;
    background-color: #6fa1c2;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    font-weight: bold;
  }
  .form-button:hover {
    background-color: #6c91aa; /* Change the color to your desired hover color */
  }
</style>
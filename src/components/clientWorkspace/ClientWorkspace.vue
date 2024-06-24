<script setup>
import Tabs from './Tabs.vue';
</script>

<template>
  
  <div class="greetings">
    <h1>RoboticFund client workspace</h1>   
    <div><Tabs /></div>
  </div>
  <div><RouterView></RouterView></div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.4rem;
  position: relative;
  top: -10px;
  color: #632050
}


.greetings h1,
.greetings h3 {
  text-align: center;
}

</style>

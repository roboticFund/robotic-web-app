<script setup>
import {Hub} from 'aws-amplify/utils'
import {  onMounted } from 'vue';
import { useRouter } from 'vue-router'; 
const router = useRouter(); 

const handleSignOutEvent = (data) => {
  switch(data.payload.event){
                case 'signOut':
                    console.log("User has signed out")
                    router.push('/')
                    break;
            }
          };

  onMounted(() => {
      Hub.listen('auth', handleSignOutEvent);
    });
</script>

<template>
  <nav>
    <router-link to="/">Home</router-link> |
    <router-link to="/about">About</router-link> |
    <router-link to="/contact">Contact</router-link> |
    <router-link to="/clientWorkspace">Client Workspace</router-link> |
    <router-link to="/admin">Admin</router-link> |    
    <template v-if="$auth.route === 'authenticated'">
      Hello {{ $auth.user?.username }}!
      <button @click="$auth.signOut">Sign out</button>
    </template>
  </nav>
  <img alt="RoboticFund logo" class="logo" src="../assets/accent2.png" width="450" height="100" />
</template>

<style scoped>

</style>

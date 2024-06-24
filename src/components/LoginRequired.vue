<template>
    <div>
      <h1>You are not authenticated to see this section of the application</h1>
      <br>
      <Authenticator />
    </div>
</template>
  
<script setup>
  import { Authenticator } from '@aws-amplify/ui-vue';
  import {Hub} from 'aws-amplify/utils';//'aws-amplify';
  import {  onMounted } from 'vue'; 
  import { useRoute, useRouter } from 'vue-router'; 
  //import { Auth } from 'aws-amplify'; // Needed if accessing Auth to check information about user
  //import { Auth } from '@aws-amplify/ui-vue';

  const router = useRouter(); 
  const route = useRoute();
  const redirectTo = route.query.redirectTo;

  const handleAuthEvent = (data) => {
  if (data.payload.event === 'signIn') {
    //console.log("User has signed in");
    //console.log("Is authenticated:", data.payload.data.username);
    //console.log("Re-direct to:", redirectTo);
    //console.log("Current Credentials: ", Auth.currentCredentials())
    console.log("Current Credentials: ", Auth.currentSession())
    if (redirectTo) {
        router.push(redirectTo); // Redirect to the URL specified in 'redirectTo'
    }   
    else {
        router.push('/'); // Fallback route if 'redirectTo' is not specified
    }
   }
  };
  onMounted(() => {
      Hub.listen('auth', handleAuthEvent);
    });
</script>
  
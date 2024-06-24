import { useAuthenticator } from '@aws-amplify/ui-vue';

const configureAuth = () => {
  const auth = useAuthenticator();

  // You can customize the authentication setup as needed, such as adding event listeners, handling authentication state, etc.

  return auth;
};

export { configureAuth };

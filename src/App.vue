<script setup>
/*import HelloWorld from './components/HelloWorld.vue'
import TheWelcome from './components/TheWelcome.vue'
import { generateClient } from "aws-amplify/api";
import { createPrivateNote } from './graphql/mutations';
import { listPrivateNotes } from './graphql/queries';
import { signIn } from 'aws-amplify/auth';
import { onMounted, ref } from 'vue';
*/
import Header from './components/Header.vue'
import '@aws-amplify/ui-vue/styles.css';
/*async function signIn({ username, password }) {
  try {
    const { isSignedIn, nextStep } = await signIn({ username, password });
  } catch (error) {
    console.log('error signing in', error);
  }
}*/
/*
const name = ref('');
const content = ref('');
const QueryResult = ref('');

const client = generateClient()


async function addNote() {
    if (!content.value ) return;
    const note = { content: content.value };
    await client.graphql({
      query: createPrivateNote,
      variables: { input: note }
    });
    content.value = '';
    //description.value = '';
  }

  async function fetchNotes() {
  try {
    const response = await client.graphql({
      query: listPrivateNotes
    });

    response.data.listPrivateNotes.items.map((note, i) => {
      QueryResult.innerHTML += `<p>${note.content}`;
    });
    console.log("Query Result: ");
    console.log(QueryResult);
  } catch (e) {
    console.log('Something went wrong', e);
  }
}

const newPrivateNote = await client.graphql({
    query: createPrivateNote,
    variables: {
        input: {
		"content": "Lorem ipsum dolor sit amet"
	}
    }
});


onMounted(() => {
  fetchNotes();
});
*/

</script>

<template>
  <div class="container">
      <header>
        <Header />
      </header>
    </div>
    <div class="container">
      <main>
        <router-view />
      </main>
    </div>
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

<!-- components/clientWorkspace/Tabs.vue -->
<template>
    <div>
      <router-link
        v-for="route in routes"
        :key="route.path"
        :to="route.path"
        :class="{ 'active-tab': isActive(route.path) }"
      >
        [ {{ route.meta.title }} ]
      </router-link>
    </div>
</template>
  
<script setup>
    import { computed } from 'vue';
    import { useRoute } from 'vue-router';

    const $route = useRoute();

    const routes = computed(() => {
    // Filter out routes that are not part of the workspace
    return $route.matched[0].children || [];
    });

    const isActive = (routePath) => {
    return $route.path.startsWith(routePath);
    };
</script>

<style scoped>
.active-tab {
font-weight: bold;
}
</style>
  
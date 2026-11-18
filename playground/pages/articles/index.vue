<script setup lang="ts">
const { data: list } = await useFetch('/api/articles')
</script>

<template>
  <div style="max-width: 640px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif;">
    <h1>Articles</h1>
    <p>Each article has its own price, set on the server. Paying for one unlocks only that article, for 24 hours.</p>

    <NuxtLink
      v-for="article in list"
      :key="article.slug"
      :to="`/articles/${article.slug}`"
      style="display: block; margin: 1rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; color: inherit; text-decoration: none;"
    >
      <strong>{{ article.title }}</strong>
      <span style="float: right; color: #555;">{{ article.price.replace('$', '') }} USDC</span>
      <p style="margin: 0.5rem 0 0; color: #555;">{{ article.summary }}</p>
    </NuxtLink>
  </div>
</template>

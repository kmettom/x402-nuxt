<template>
  <div>
    <nav style="padding: 1rem; border-bottom: 1px solid #ddd; font-family: system-ui, sans-serif;">
      <NuxtLink to="/" style="margin-right: 1rem;">Home</NuxtLink>
      <NuxtLink to="/protected" style="margin-right: 1rem;">Protected Page</NuxtLink>
      <NuxtLink to="/premium">Premium Page</NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>

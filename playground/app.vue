<template>
  <div>
    <nav style="display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 1rem; border-bottom: 1px solid #ddd; font-family: system-ui, sans-serif;">
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/protected">Fixed price</NuxtLink>
      <NuxtLink to="/donate">Donation</NuxtLink>
      <NuxtLink to="/articles">Articles</NuxtLink>
      <NuxtLink to="/shop">Shop</NuxtLink>
      <span style="margin-left: auto;"><WalletBar /></span>
    </nav>
    <NuxtPage />
  </div>
</template>

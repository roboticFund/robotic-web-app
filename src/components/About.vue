<script setup>
import WelcomeItem from './WelcomeItem.vue'
import DocumentationIcon from './icons/IconDocumentation.vue'
import ToolingIcon from './icons/IconTooling.vue'
import EcosystemIcon from './icons/IconEcosystem.vue'
import CommunityIcon from './icons/IconCommunity.vue'
//import SupportIcon from './icons/IconSupport.vue'
</script>

<template>
  <!--<div>
    <img alt="RoboticFund code" src="../assets/homescreen-code.webp"  />
  </div>-->
  <WelcomeItem>
    <template #icon>
      <DocumentationIcon />
    </template>
    <template #heading>About Robotic Fund</template>        
    Robotic Fund is a technology company that specialises in developing innovative solutions for investments. 
    Our cutting-edge technology and expertise allow us to provide our clients with smarter investment options
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <ToolingIcon />
    </template>
    <template #heading>Our philosophy</template>

    We have developed highly sophisticated technology that is capable of analysing, predicting and 
    trading on financial markets, thousands of times per second. Leveraging on speed and pre-programmed instructions.

    <br /><br>

    Our advanced projection tooling is capable of simulating years worth of historical trading history with a high degree of precision.
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <EcosystemIcon />
    </template>
    <template #heading>Why Choose Robotic Fund</template>
    Discover the benefits of investing with Robotic Fund, including our advanced technology, expert advice, and personalised investment options.
    <br>
    Invest with Confidence
    <br>
    Our commitment to data led solutions means that our instruments undergo rigous analysis and testing. Our system is fully autonomous and robust. 
    We leverage cloud technology and maintain a 99.99% track record of system uptime.
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <CommunityIcon />
    </template>
    <template #heading><a href="/contact">Contact Us</a></template>
   
  </WelcomeItem>
</template>

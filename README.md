# FORESIGHT<sup>PHAC</sup>

## I. The Next Frontier in Public Health Intelligence

With the advent of novel technologies, our approach towards problem-solving is undergoing a paradigm shift, enabling more profound and multifaceted analyses. Our early attempt of NLP-pipeline prototype for GPHIN Next Generation represents an initial foray into leveraging technology for public health surveillance, yet it merely skims the surface of potential applications. Current capabilities extend far beyond, with the capacity to process from seven thousand to millions of articles and billions of data points every day, highlighting *the critical need for automation and efficiency enhancement in data processing and analysis*.

Our previous work to enhance and expand the NLP-pipeline prototype - a `Data Mesh Reference Implementation` (DMRI) - provided great insights, demonstrating that *the design patterns and methodologies developed are versatile and applicable across a spectrum of domains*, including climate change amongst other public health arenas. This versatility underscores the potential to shift our focus towards the construction of dynamically built knowledge graphs, moving away from the confines of traditional taxonomy searches.

In the broader context, news article processing is depicted as a small component in a vast and intricate delta river system, representing just one stream of information in a complex ecosystem of data. The onus is on us to focus on this entire ecosystem, ensuring *a holistic and integrative approach to public health surveillance and beyond*: zooming out and looking at the entire ecosystem, making our early attempt one piece of a larger puzzle.

The DMRI does highlight the imperative for a more expansive and impactful approach. First and foremost, there is a pressing need to refine our detection, understanding, and response mechanisms across 64 surveillance pipelines to address present challenges more effectively. Additionally, we must intensify our support for clinical and preventive care activities across 13 participating jurisdictions, ultimately benefiting 40 million citizens.

It is now crucial to establish *a robust framework for addressing an array of emerging threats, including the impacts of climate change, disparities in healthcare access, the rise of resistant diseases, financial challenges in healthcare, and the deterioration of mental health*. Addressing these facets is paramount for elevating the overall impact of the Agency.

The scope of information sources for public health surveillance should extend well beyond news articles. We must tap into thousands of verifiable documents originating from diverse entities such as governments, NGOs, corporations, and academic institutions, all of which contribute real-time data. Analytical outcomes from a myriad or sources should be integrated to bolster our capabilities in both detection and comprehension of public health issues. Leveraging population-level data from participating territories (PTs) is also imperative, as it enables the accumulation of substantial data masses to reveal emerging issues, spread patterns, and prevailing trends.

Finally, we need to move from one dimensional to multi-dimensional visual data analysis tools. Drawing an analogy with newspaper layout decisions, where determining what makes the front page is crucial, our goal is to sift through the extensive information available, highlighting the most pertinent and impactful data. This approach ensures that critical information is promptly identified and addressed, fostering a proactive and informed public health response. Imagine *the profound insights and rapid response capabilities* we could unlock by simultaneously visualizing all of the front pages across various dimensions and perspectives, transforming our analysis into a rich, comprehensive tapestry of information.

## II. Introduction

Our previous approach cannot scale for analyzing millions of news articles, public health threats, daily events, cumulative multi-day datasets, academic knowledge base, primary care PT data, and others.

We can do more, do it better, and cover more ground – all more efficiently than ever before. We have proven this.

## III. A playground for everyone

### A. Initial End State

The envisioned end state of the playground is to create *a comprehensive, state-of-the-art artificial intelligence system focused on public health, incorporating advanced natural language processing (NLP) to identify potential threats from wide-ranging perspectives*. Achieving this state requires a deep understanding of domain-specific knowledge, proficiency in AI and NLP technologies, and robust implementation capabilities.

Transitioning from systems predominantly processing news articles, necessitates a broader scope of surveillance and analysis.

1. **Broadening Detection Scope**: Extend our capabilities to identify relevant content across diverse formats, including news articles, documents, and videos, ensuring a comprehensive collection of pertinent data.
2. **Enhanced Visualization**: Integrate the detected information with our existing knowledge base, employing visualization tools to depict relationships and contexts, aiding in a more intuitive understanding of the data.
3. **Streamlined Data Management**: Automate the processes of collection, organization, and analysis, utilizing domain-specific knowledge to decode and comprehend the detected information efficiently.
4. **Dynamic Analysis of Information Flow**: Monitor and analyze shifts, patterns, and trends within the information mass, gaining insights into its nature, properties, and potential implications.
5. **Informed Decision-Making**: Generate recommendations by drawing comparisons with historical decisions, incorporating expert opinions, and evaluating the relationship between information sources and affected entities.

Our processing capabilities will be significantly enhanced, moving from handling a mere some thousands news articles daily to efficiently managing and analyzing millions. This involves not only accurately identifying relevant news items but also grouping articles based on similarities and detecting emerging patterns and trends. The system will utilize domain-specific knowledge graphs for more nuanced analysis and employ reinforcement learning to continually refine its performance.

**During and Post Initial Period**: To maximize usability for scientists and analysts, the system will feature a user-friendly, highly customizable interface, providing diverse viewing options ranging from broad overviews to detailed insights on specific articles. Enhanced interaction will be facilitated through touch and voice commands, and users will have the ability to annotate, highlight, comment on, collate, and share pertinent articles. Additionally, the system will enable the creation of tailored reports to meet the needs of external stakeholders, ensuring a holistic approach to public health surveillance and response.

***News articles are but the start.***

### III.B Future States

Addressing the transition to a more comprehensive public health surveillance system requires clear communication and collaboration with all involved parties. Succinctly, this can be stated as follows:

Initiating Small-Scale Projects: 
1. **Demonstrate** that the platform can accommodate the needs and desires of experts, stakeholders, and participating entities, starting with manageable, small-scale initiatives.
2. **Empowering User Ownership**: Ensure that users, be they experts or stakeholders, retain control and ownership over the initiatives and functionalities they wish to implement and experiment with.
3. **Stewardship of the Platform**: Emphasize our role as custodians of the platform, facilitating the execution of user-driven initiatives and ensuring a supportive environment for innovation.
4. **User-Driven Success**: Acknowledge that the platform's success is predominantly contingent upon the contributions and engagement of the users, rather than solely on the proficiency of our development efforts. This platform would serve as an innovative hub for domain experts, facilitating the proposal of ideas, experiments, and tests. Moreover, it would empower these professionals to execute their plans with a degree of automation, optimizing the storytelling potential for the constantly evolving Minimum Viable Product (MVP).
5. **From Success to Scalability**: Leverage successful small-scale implementations as a springboard to develop a GPHIN-like platforms, all while maintaining our integral role and connection within the community.

## IV. Defining a Full Prototype

1. **Broadening Detection Scope**
    - Extend our capabilities to identify relevant content across diverse formats, including news articles, documents, and videos, ensuring a comprehensive collection of pertinent data.
    - *Specific Outputs*:
        - Ingest News Provider articles (e.g., Factiva, RSS).
        - (**not implemented for now**) Ingest RSS, Public Health Documents and Videos (related to health and public health).
            - For Videos, leverage AI to understand what the video is about and produce text description
        - (**not implemented for now**) Harvest and Ingest HC and PHAC standards and policies for establishing ground truths.
2. **Enhanced Visualization for At-a-Glance Detection of Events**
    - Integrate the detected information with our existing knowledge base, employing visualization tools to depict relationships and contexts, aiding in a more intuitive understanding of the data.
    - Web-based interfaces leveraging modern data infrastructures.
    - *Specific Outputs*:
        - Eliminating the need for manually sifting through articles.
        - Show innovative ways to detect signals, aberrations, anomalies, hazards … at a glance.
        - Develop enhanced business process flows.
        - Detect emergent events that were unknown.
        - Detect weak signals from different sources of data (e.g. patient population EHR repositories).
        - Create dynamic data analysis and data exploration dashboards.
        - Test and demonstrate data exploration through human language querying.
3. **Streamlined Data Management**
    - Automate the processes of collection, organization, and analysis, utilizing domain-specific knowledge to decode and comprehend the detected information efficiently.
    - *Specific Outputs*:
        - Identify a few machine-readable ontologies.
        - Fully standards compliant, pluggable to other PHAC systems.
4. **Dynamic Analysis of Information Flow**
    - Monitor and analyze shifts, patterns, and trends within the information mass, gaining insights into its nature, properties, and potential implications. Note. David B suggests building uses cases for both static and dynamic analysis.
    - *Specific Outputs*:
        - Temporal Analysis: Assess the progression of data over time to identify emerging trends or sudden spikes in specific public health threats.
            - How do we show it, how can people leverage this?
            - How do we show cause effect relationships?
            - Show novel interactions of analyzing data.
        - How can we present Geographical Information to identify regions with increased activity or potential outbreaks, allowing for targeted interventions?
        - Predictive Analytics: Utilize historical data to predict potential future trends, enabling proactive measures rather than reactive responses.
5. **Informed Decision-Making**
    - Generate recommendations by drawing comparisons with historical decisions, incorporating expert opinions, and evaluating the relationship between information sources and affected entities.
    - *Specific Outputs*:
        - Clear explanations of how AI-enabled signals are detected and presented.
        - Think about types of time-based information analysis.
        - We need to show three novel ways of data and information interpretation and navigation. Considers different ways of data analysis and contrast to previous ways of interacting with information.
        - AI assisted interaction. 
6. **For Later**
    - Transparency: Clearly communicate the rationale behind decisions to all stakeholders, fostering trust and understanding.
    - Ethical Considerations: Ensure that decisions uphold the highest ethical standards, considering both immediate and long-term impacts.
    - Risk Assessment: Evaluate potential risks associated with each decision, preparing for possible challenges and planning mitigative measures.


## V. A new journey begins!

**Milestones:**
1. [The story of Alice](./doc/milestone-1.md).

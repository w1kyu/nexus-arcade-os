# Automata Lab

An interactive laboratory for finite state automata (DFA and NFA with epsilon transitions) and regular expressions.

## Features

- **Visual Editor**: Add states, define start and accepting states (double circle), create transitions with symbols or epsilon (ε).
- **Step-by-Step Simulation**: Step through an input word, showing all active states and epsilon-closures simultaneously.
- **Batch Word Tester**: Test multiple candidate words at once with instant Accepted/Rejected verdicts.
- **NFA → DFA Subset Construction**: Computes the powerset DFA from an NFA step by step.
- **DFA Minimization**: Identifies equivalent states with the table-filling algorithm to produce the minimal quotient DFA.
- **Thompson Regex → ε-NFA**: Parses regular expressions (`|`, `*`, `+`, `?`, `()`) and constructs equivalent epsilon-NFAs.
- **Set Operations**: Complement, Union, and Intersection through product construction.

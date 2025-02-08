from character_generator import CharacterGenerator
import sys

def main():
    if len(sys.argv) != 2:
        print("Usage: python generate_character.py <config_file>")
        print("Example: python generate_character.py character_config.json")
        sys.exit(1)

    config_file = sys.argv[1]
    
    # Initialize the character generator and process the config file
    generator = CharacterGenerator()
    generator.process_config(config_file)

if __name__ == "__main__":
    main()
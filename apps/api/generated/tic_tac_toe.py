class Board:
    def __init__(self):
        self.board = [' ' for _ in range(9)]
    
    def display(self):
        print(f"\n {self.board[0]} | {self.board[1]} | {self.board[2]} ")
        print("-----------")
        print(f" {self.board[3]} | {self.board[4]} | {self.board[5]} ")
        print("-----------")
        print(f" {self.board[6]} | {self.board[7]} | {self.board[8]} ")
        print()
    
    def display_positions(self):
        print("\nPositions:")
        print(" 1 | 2 | 3 ")
        print("-----------")
        print(" 4 | 5 | 6 ")
        print("-----------")
        print(" 7 | 8 | 9 ")
        print()
    
    def is_valid_move(self, position):
        return 1 <= position <= 9 and self.board[position - 1] == ' '
    
    def make_move(self, position, player):
        if self.is_valid_move(position):
            self.board[position - 1] = player
            return True
        return False
    
    def check_winner(self):
        winning_combinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],  # rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8],  # columns
            [0, 4, 8], [2, 4, 6]              # diagonals
        ]
        
        for combo in winning_combinations:
            if (self.board[combo[0]] == self.board[combo[1]] == self.board[combo[2]] 
                and self.board[combo[0]] != ' '):
                return self.board[combo[0]]
        return None
    
    def is_full(self):
        return ' ' not in self.board
    
    def reset(self):
        self.board = [' ' for _ in range(9)]

def get_player_input(player):
    while True:
        try:
            position = int(input(f"Player {player}, enter position (1-9): "))
            return position
        except ValueError:
            print("Invalid input! Please enter a number between 1 and 9.")

def main():
    board = Board()
    current_player = 'X'
    
    print("Welcome to Tic Tac Toe!")
    board.display_positions()
    
    while True:
        board.display()
        
        position = get_player_input(current_player)
        
        if not board.is_valid_move(position):
            print("Invalid move! Position already taken or out of range.")
            continue
        
        board.make_move(position, current_player)
        
        winner = board.check_winner()
        if winner:
            board.display()
            print(f"Player {winner} wins!")
            break
        
        if board.is_full():
            board.display()
            print("It's a draw!")
            break
        
        current_player = 'O' if current_player == 'X' else 'X'
    
    while True:
        play_again = input("Play again? (y/n): ").lower()
        if play_again == 'y':
            board.reset()
            current_player = 'X'
            main()
            break
        elif play_again == 'n':
            print("Thanks for playing!")
            break
        else:
            print("Please enter 'y' or 'n'.")

if __name__ == "__main__":
    main()

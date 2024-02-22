USE food_db;

-- Inserting customers
INSERT INTO customers (name, email, address) VALUES
    ('John Doe', 'john@example.com', '1234 Main St'),
    ('Jane Smith', 'jane@example.com', '5678 Market St');

-- Inserting stores
INSERT INTO stores (name, address) VALUES
    ('Good Eats', '123 Food Lane'),
    ('Tasty Coffee in the world', '456 Snack Ave');

-- Inserting food items
INSERT INTO food_items (name, description, price, size, category, store_id) VALUES
    ('Pad Thai', 'Stir-fried rice noodles with shrimp and vegetables', 10.99, 'Regular', 'Main Courses', 1),
    ('Green Curry', 'Thai green curry with chicken and coconut milk', 12.99, 'Regular', 'Main Courses', 1),
    ('Red Curry Salmon', 'Salmon cooked in red curry sauce', 15.49, 'Regular', 'Seafood', 1),
    ('Thai Basil Shrimp', 'Shrimp stir-fried with basil leaves', 14.99, 'Regular', 'Seafood', 1),
    ('Spring Rolls', 'Crispy spring rolls with dipping sauce', 5.99, 'Small', 'Appetizers', 1),
    ('Satay Chicken', 'Grilled chicken skewers with peanut sauce', 7.49, 'Small', 'Appetizers', 1),
    ('Tom Yum Soup', 'Spicy and sour soup with shrimp and mushrooms', 6.99, 'Regular', 'Appetizers', 1),
    ('Green Papaya Salad', 'Shredded green papaya salad', 8.99, 'Regular', 'Salads', 1),
    ('Som Tum Salad', 'Papaya salad with peanuts and lime', 7.99, 'Regular', 'Salads', 1),
    ('Glass Noodle Salad', 'Glass noodle salad with vegetables', 6.49, 'Regular', 'Salads', 1),
    ('Spicy Coconut Clams', 'Clams cooked in spicy coconut broth', 13.99, 'Regular', 'Seafood', 1),
    ('Mango Sticky Rice', 'Sweet sticky rice with mango', 6.49, 'Small', 'Desserts', 1),
    ('Pineapple Fried Rice', 'Fried rice with pineapple and chicken', 11.99, 'Regular', 'Main Courses', 1),
    ('Crispy Duck', 'Crispy duck with plum sauce', 16.99, 'Regular', 'Main Courses', 1),
    ('Thai Iced Tea', 'Sweet and creamy Thai iced tea', 3.99, 'Regular', 'Beverages', 1),
    ('Steamed Jasmine Rice', 'Steamed fragrant jasmine rice', 2.99, 'Small', 'Sides', 1),
    ('Pad See Ew', 'Stir-fried wide rice noodles with chicken', 11.49, 'Regular', 'Main Courses', 1),
    ('Mango Salad', 'Mango salad with chili and lime dressing', 7.49, 'Regular', 'Salads', 1),
    ('Vegetable Spring Rolls', 'Crispy vegetable spring rolls', 4.99, 'Small', 'Appetizers', 1),
    ('Coconut Soup', 'Coconut milk soup with chicken and mushrooms', 6.99, 'Regular', 'Appetizers', 1),
     ('Iced Coffee', 'Classic iced coffee', 3.49, 'Regular', 'Coffee', 2),
     ('Cappuccino', 'Espresso with steamed milk and foam', 4.99, 'Small', 'Coffee', 2),
     ('Latte', 'Espresso with steamed milk', 4.49, 'Regular', 'Coffee', 2),
     ('Mocha', 'Espresso with chocolate and steamed milk', 4.99, 'Regular', 'Coffee', 2),
     ('Espresso', 'Strong black coffee', 2.99, 'Single Shot', 'Coffee', 2),
     ('Iced Tea', 'Chilled tea with ice', 2.49, 'Regular', 'Tea', 2),
     ('Chai Latte', 'Spiced tea with steamed milk', 4.99, 'Small', 'Tea', 2),
     ('Green Tea', 'Steamed green tea', 3.49, 'Regular', 'Tea', 2),
     ('Black Tea', 'Classic black tea', 2.99, 'Regular', 'Tea', 2),
     ('Herbal Tea', 'Herbal infusion', 3.49, 'Regular', 'Tea', 2),
     ('Orange Juice', 'Freshly squeezed orange juice', 3.99, 'Regular', 'Fruit Juice', 2),
     ('Apple Juice', 'Fresh apple juice', 3.49, 'Regular', 'Fruit Juice', 2),
     ('Pineapple Juice', 'Sweet pineapple juice', 3.49, 'Regular', 'Fruit Juice', 2),
     ('Lemonade', 'Refreshing lemonade', 2.99, 'Regular', 'Soft Drink', 2),
     ('Coca-Cola', 'Classic cola', 2.49, 'Regular', 'Soft Drink', 2),
     ('Sprite', 'Lemon-lime soda', 2.49, 'Regular', 'Soft Drink', 2),
     ('Root Beer', 'Root beer soda', 2.49, 'Regular', 'Soft Drink', 2),
     ('Ginger Ale', 'Ginger-flavored soda', 2.49, 'Regular', 'Soft Drink', 2),
     ('Sparkling Water', 'Carbonated water', 2.99, 'Regular', 'Water', 2),
     ('Still Water', 'Still bottled water', 1.99, 'Regular', 'Water', 2);

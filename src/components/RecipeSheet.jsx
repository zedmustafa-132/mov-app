import { useState, useMemo } from 'react'
import { useNutrition } from '../store/useNutrition.js'
import { useUI } from '../store/useUI.js'
import { calculateRecipeTotals, recipeToFoodItem } from '../lib/nutrition/recipes.js'
import { FoodSearchSheet } from './FoodSearchSheet.jsx'
import { Button, TextField, NumberField, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export function RecipeSheet({ date, meal = 'lunch', close }) {
  const recipes = useNutrition(s => s.recipes || [])
  const saveRecipe = useNutrition(s => s.saveRecipe)
  const logFood = useNutrition(s => s.logFood)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)

  const [mode, setMode] = useState('list') // 'list' | 'create' | 'view'
  const [activeRecipe, setActiveRecipe] = useState(null)

  // Create recipe state
  const [name, setName] = useState('')
  const [servings, setServings] = useState(2)
  const [ingredients, setIngredients] = useState([])

  // Calculate live totals for the draft recipe
  const draftTotals = useMemo(() => {
    return calculateRecipeTotals({ servings, ingredients })
  }, [servings, ingredients])

  // Open ingredient picker
  const handleAddIngredient = () => {
    openSheet(closeSearch => (
      <FoodSearchSheet
        meal={meal}
        date={date}
        close={closeSearch}
      />
    ))
  }

  // Save the new recipe
  const handleSaveRecipe = () => {
    if (!name.trim()) {
      toast(t('Please enter a recipe name'))
      return
    }
    if (ingredients.length === 0) {
      toast(t('Please add at least one ingredient'))
      return
    }

    const newRecipe = {
      id: `rcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      servings: Number(servings) || 1,
      ingredients,
      totals: draftTotals.totals,
      perServing: draftTotals.perServing,
      createdAt: new Date().toISOString()
    }

    saveRecipe(newRecipe)
    toast(t('Recipe saved!'))
    setMode('list')
    setName('')
    setServings(2)
    setIngredients([])
  }

  // Log 1 serving of a recipe to diary
  const handleLogServing = (recipe, targetMeal = meal) => {
    const foodItem = recipeToFoodItem(recipe)
    logFood(date, targetMeal, foodItem, 1, 'serving')
    toast(t('Logged 1 serving of {0} to {1}!', recipe.name, targetMeal))
    close()
  }

  // View recipe details
  if (mode === 'view' && activeRecipe) {
    const totals = calculateRecipeTotals(activeRecipe)
    return (
      <div className="recipe-detail-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row between">
          <button className="iconbtn" onClick={() => setMode('list')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
          <h3 style={{ margin: 0 }}>{activeRecipe.name}</h3>
          <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
        </div>

        <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 12 }}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span className="muted">{t('Per Serving (1 of {0})', activeRecipe.servings)}</span>
            <span className="big" style={{ fontSize: 18, fontWeight: 700 }}>
              {totals.perServing.calories} <span className="small muted">kcal</span>
            </span>
          </div>
          <div className="row between small">
            <span><b style={{ color: 'var(--blue)' }}>P:</b> {totals.perServing.protein}g</span>
            <span><b style={{ color: 'var(--orange)' }}>C:</b> {totals.perServing.carbs}g</span>
            <span><b style={{ color: 'var(--yellow)' }}>F:</b> {totals.perServing.fat}g</span>
            <span className="dim">{totals.perServing.weightGrams}g</span>
          </div>
        </div>

        <div>
          <div className="lbl2" style={{ marginBottom: 8 }}>{t('Ingredients ({0})', (activeRecipe.ingredients || []).length)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(activeRecipe.ingredients || []).map((ing, idx) => (
              <div key={idx} className="row between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{ing.name}</div>
                  <div className="small muted">{ing.qty} {ing.unit}</div>
                </div>
                <div className="small" style={{ textAlign: 'right' }}>
                  <div>{ing.nutrients?.calories || 0} kcal</div>
                  <div className="dim">P: {ing.nutrients?.protein || 0}g</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <Button variant="primary" icon="plus" onClick={() => handleLogServing(activeRecipe)}>
            {t('Log 1 Serving to Diary')}
          </Button>
        </div>
      </div>
    )
  }

  // Create recipe mode
  if (mode === 'create') {
    return (
      <div className="recipe-create-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row between">
          <button className="iconbtn" onClick={() => setMode('list')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
          <h3 style={{ margin: 0 }}>{t('New Recipe')}</h3>
          <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
        </div>

        <div>
          <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Recipe Name *')}</label>
          <TextField
            placeholder={t('e.g. High-Protein Overnight Oats')}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Number of Servings')}</label>
          <NumberField value={servings} onChange={setServings} decimal={false} />
        </div>

        <div>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="lbl2">{t('Ingredients')}</span>
            <Button size="sm" variant="tinted" icon="plus" onClick={handleAddIngredient}>
              {t('Add Food')}
            </Button>
          </div>

          {ingredients.length === 0 ? (
            <div className="empty" style={{ padding: '20px 10px', textAlign: 'center' }}>
              <span className="small muted">{t('No ingredients added yet. Tap "+ Add Food" to search.')}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ingredients.map((ing, i) => (
                <div key={i} className="row between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{ing.name}</div>
                    <div className="small muted">{ing.qty} {ing.unit} · {ing.nutrients?.calories || 0} kcal</div>
                  </div>
                  <button
                    className="iconbtn"
                    style={{ color: 'var(--red)' }}
                    onClick={() => setIngredients(cur => cur.filter((_, idx) => idx !== i))}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {ingredients.length > 0 && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 12 }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="muted">{t('Per Serving (1 of {0})', servings)}</span>
              <span className="big" style={{ fontSize: 18, fontWeight: 700 }}>
                {draftTotals.perServing.calories} <span className="small muted">kcal</span>
              </span>
            </div>
            <div className="row between small">
              <span><b style={{ color: 'var(--blue)' }}>P:</b> {draftTotals.perServing.protein}g</span>
              <span><b style={{ color: 'var(--orange)' }}>C:</b> {draftTotals.perServing.carbs}g</span>
              <span><b style={{ color: 'var(--yellow)' }}>F:</b> {draftTotals.perServing.fat}g</span>
            </div>
          </div>
        )}

        <Button variant="primary" icon="check" onClick={handleSaveRecipe} disabled={!name.trim() || !ingredients.length}>
          {t('Save Recipe')}
        </Button>
      </div>
    )
  }

  // Recipes list mode
  return (
    <div className="recipe-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{t('Recipes')}</h3>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
      </div>

      <Button variant="tinted" icon="plus" onClick={() => setMode('create')}>
        {t('Create New Recipe')}
      </Button>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recipes.length === 0 ? (
          <div className="empty" style={{ padding: '30px 10px', textAlign: 'center' }}>
            <div className="muted small">{t('No recipes saved yet.')}</div>
            <div className="dim small" style={{ marginTop: 4 }}>
              {t('Combine multiple foods and calculate per-serving nutrition easily.')}
            </div>
          </div>
        ) : (
          recipes.map(recipe => (
            <div
              key={recipe.id}
              className="row between tappable"
              style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setActiveRecipe(recipe)
                setMode('view')
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{recipe.name}</div>
                <div className="small muted" style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span>{recipe.perServing?.calories || 0} kcal / serving</span>
                  <span style={{ color: 'var(--blue)' }}>P: {recipe.perServing?.protein || 0}g</span>
                  <span className="dim">({recipe.servings} servings)</span>
                </div>
              </div>
              <Icon name="chevronRight" className="chev" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
